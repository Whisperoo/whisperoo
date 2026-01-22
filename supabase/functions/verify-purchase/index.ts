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

    // Get the product file from storage
    const product = purchase.product;
    console.log("Product data:", product);

    if (!product?.id) {
      console.error("Product ID not found");
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

    // Generate a download URL
    let downloadUrl = null;

    if (
      product.file_url &&
      product.file_url.trim() !== "" &&
      product.file_url !== "null"
    ) {
      // Check if it's a full URL or a storage path
      if (product.file_url.startsWith("http")) {
        // It's a full URL, use directly
        console.log("Using direct file URL:", product.file_url);
        downloadUrl = product.file_url;
      } else {
        // It's a storage path, generate signed URL
        console.log(
          "Generating signed URL for storage path:",
          product.file_url,
        );

        // First, check if the file exists
        const { data: fileExists, error: checkError } =
          await supabaseClient.storage
            .from("products")
            .list(product.file_url.split("/").slice(0, -1).join("/"), {
              limit: 100,
              search: product.file_url.split("/").pop(),
            });

        if (!checkError && fileExists && fileExists.length > 0) {
          const { data: urlData, error: urlError } =
            await supabaseClient.storage
              .from("products")
              .createSignedUrl(product.file_url, 3600); // 1 hour expiry

          if (!urlError && urlData) {
            downloadUrl = urlData.signedUrl;
          } else {
            console.error("Error generating signed URL:", urlError);
          }
        } else {
          console.error("File not found in storage:", product.file_url);
        }
      }
    }

    // If we still don't have a download URL, try the default pattern
    if (!downloadUrl && product.expert_id && product.id) {
      const fileExtension = product.product_type === "video" ? "mp4" : "pdf";
      const defaultPath = `${product.expert_id}/${product.id}.${fileExtension}`;
      console.log("Trying default storage path:", defaultPath);

      const { data: urlData, error: urlError } = await supabaseClient.storage
        .from("products")
        .createSignedUrl(defaultPath, 3600); // 1 hour expiry

      if (!urlError && urlData) {
        downloadUrl = urlData.signedUrl;
        console.log("Successfully generated URL with default path");
      } else {
        console.error("Failed to generate URL with default path:", urlError);
      }
    }

    if (!downloadUrl) {
      return new Response(
        JSON.stringify({
          has_access: true, // User has purchased but file is missing
          error: "Product file is not yet available. Please contact support.",
          product: {
            id: product.id,
            title: product.title,
            product_type: product.product_type,
            file_url: product.file_url, // Include for debugging
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        },
      );
    }

    console.log("Final download URL:", downloadUrl);

    // NEW: Download the file and proxy it with correct headers for Safari
    try {
      const fileResponse = await fetch(downloadUrl, {
        headers: {
          Accept: "*/*",
        },
      });

      if (!fileResponse.ok) {
        throw new Error(
          `Failed to fetch file from storage: ${fileResponse.status}`,
        );
      }

      // Get file data
      const fileBuffer = await fileResponse.arrayBuffer();
      const contentType =
        fileResponse.headers.get("content-type") ||
        (product.product_type === "video" ? "video/mp4" : "application/pdf");

      // Set file extension based on product type
      const fileExtension = product.product_type === "video" ? "mp4" : "pdf";

      // Create a safe filename (remove special characters)
      const safeTitle = product.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const filename = `${safeTitle}.${fileExtension}`;

      // Return the actual file with correct headers
      return new Response(fileBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": fileBuffer.byteLength.toString(),
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    } catch (proxyError) {
      console.error("Error proxying file download:", proxyError);

      // Fallback: Return JSON with URL if proxy fails
      return new Response(
        JSON.stringify({
          has_access: true,
          product: {
            id: product.id,
            title: product.title,
            download_url: downloadUrl,
            product_type: product.product_type,
            file_size_mb: product.file_size_mb,
          },
          purchase: {
            id: purchase.id,
            purchased_at: purchase.purchased_at,
            amount: purchase.amount,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        has_access: false,
        error: "Internal server error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
