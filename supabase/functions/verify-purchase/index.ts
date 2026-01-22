import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // Get the session or user object
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Parse request body
    const { product_id } = await req.json();

    if (!product_id) {
      return new Response(JSON.stringify({ error: "Product ID is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Check if user has purchased this product
    const { data: purchase, error: purchaseError } = await supabaseClient
      .from("purchases")
      .select(
        `
        *,
        product:products(*)
      `,
      )
      .eq("user_id", user.id)
      .eq("product_id", product_id)
      .eq("status", "completed")
      .single();

    if (purchaseError || !purchase) {
      return new Response(
        JSON.stringify({
          has_access: false,
          error: "Product not purchased or purchase not completed",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        },
      );
    }

    // Get the product
    const product = purchase.product;

    if (!product?.id) {
      return new Response(
        JSON.stringify({
          has_access: false,
          error: "Product not found",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        },
      );
    }

    // Check for R2 URL in file_url field
    let r2Url = null;

    // Look for R2 URL in various fields
    const possibleUrlFields = [
      product.file_url,
      product.primary_file_url,
      product.download_url,
    ];

    for (const urlField of possibleUrlFields) {
      if (
        urlField &&
        typeof urlField === "string" &&
        urlField.includes("r2.dev")
      ) {
        r2Url = urlField.trim();
        console.log("Found R2 URL in field:", r2Url);
        break;
      }
    }

    if (!r2Url) {
      console.log(
        "Product data for debugging:",
        JSON.stringify(product, null, 2),
      );
      return new Response(
        JSON.stringify({
          has_access: true,
          error: "Product file URL not found in database",
          debug: {
            product_id: product.id,
            file_url: product.file_url,
            primary_file_url: product.primary_file_url,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        },
      );
    }

    // Validate the R2 URL
    if (!r2Url.startsWith("http")) {
      r2Url = `https://${r2Url}`;
    }

    console.log("Proxying R2 URL:", r2Url);

    // Fetch the file from R2
    try {
      const fileResponse = await fetch(r2Url, {
        headers: {
          Accept: "*/*",
          "User-Agent": "Mozilla/5.0",
        },
      });

      console.log("R2 response status:", fileResponse.status);
      console.log(
        "R2 response headers:",
        Object.fromEntries(fileResponse.headers.entries()),
      );

      if (!fileResponse.ok) {
        if (fileResponse.status === 404) {
          return new Response(
            JSON.stringify({
              has_access: true,
              error: "File not found in Cloudflare R2 storage",
              debug: {
                r2_url: r2Url,
                status: fileResponse.status,
              },
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 404,
            },
          );
        }

        throw new Error(`R2 returned status: ${fileResponse.status}`);
      }

      // Get file data
      const fileBuffer = await fileResponse.arrayBuffer();

      // Determine content type
      let contentType = fileResponse.headers.get("content-type");
      if (!contentType) {
        contentType =
          product.product_type === "video" ? "video/mp4" : "application/pdf";
      }

      // Create safe filename
      const fileExtension = product.product_type === "video" ? "mp4" : "pdf";
      const safeTitle = product.title
        .replace(/[^a-z0-9]/gi, "_")
        .substring(0, 100) // Limit length
        .toLowerCase();
      const filename = `${safeTitle}.${fileExtension}`;

      // Return the file with proper download headers for Safari
      return new Response(fileBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": fileBuffer.byteLength.toString(),
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "Access-Control-Expose-Headers":
            "Content-Disposition, Content-Length",
        },
      });
    } catch (fetchError) {
      console.error("Error fetching from R2:", fetchError);

      // Fallback: Return JSON with the URL
      return new Response(
        JSON.stringify({
          has_access: true,
          product: {
            id: product.id,
            title: product.title,
            download_url: r2Url, // Return the direct R2 URL as fallback
            product_type: product.product_type,
          },
          warning: "Proxying failed, using direct URL (may not work in Safari)",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (error) {
    console.error("Error in edge function:", error);
    return new Response(
      JSON.stringify({
        has_access: false,
        error: "Internal server error",
        details: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
