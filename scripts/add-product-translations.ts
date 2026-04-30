import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const googleKey = process.env.VITE_GOOGLE_TRANSLATE_API_KEY;

if (!googleKey) {
  console.error('Missing Google Translate API key.');
  process.exit(1);
}

const localesDir = path.resolve(process.cwd(), 'src/i18n/locales');

const newEnTranslations = {
  searchPlaceholder: "Search products by title or description...",
  search: "Search",
  foundResults: "🔍 Found {{count}} product(s) for \"{{query}}\"",
  page: "(Page {{page}})",
  clearSearch: "Clear search",
  allCategories: "All Categories",
  allTypes: "All Types",
  sortBy: "Sort by",
  sort: {
    personalized: "For You",
    newest: "Newest First",
    oldest: "Oldest First",
    priceLowToHigh: "Price: Low to High",
    priceHighToLow: "Price: High to Low",
    highestRated: "Highest Rated",
    title: "Title: A to Z"
  },
  types: {
    document: "Document",
    video: "Video",
    audio: "Audio",
    course: "Course",
    consultation: "Consultation"
  },
  contentType: {
    bundle: "Bundle (Related files)",
    course: "Course (Structured learning)",
    collection: "Collection (Curated set)"
  },
  categories: {
    courses: "Courses",
    ebooks: "eBooks",
    toolkits: "Toolkits",
    webinars: "Webinars",
    checklists: "Checklists",
    guides: "Guides",
    templates: "Templates",
    videos: "Videos"
  }
};

async function translate(text: string, targetLang: string): Promise<string> {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${googleKey}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'en',
        target: targetLang,
        format: 'text',
      }),
    });
    const data = await response.json();
    return data?.data?.translations?.[0]?.translatedText || text;
  } catch (err) {
    console.error(`Failed to translate to ${targetLang}:`, err);
    return text;
  }
}

async function translateObject(obj: any, targetLang: string): Promise<any> {
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      // Don't translate placeholders like {{count}}
      const parts = val.split(/(\{\{[^}]+\}\})/g);
      let translatedStr = '';
      for (const part of parts) {
        if (part.startsWith('{{') && part.endsWith('}}')) {
          translatedStr += part;
        } else if (part.trim()) {
          translatedStr += await translate(part, targetLang);
        } else {
          translatedStr += part;
        }
      }
      result[key] = translatedStr;
    } else if (typeof val === 'object') {
      result[key] = await translateObject(val, targetLang);
    }
  }
  return result;
}

async function run() {
  const targets = ['en', 'es', 'vi'];
  
  for (const lang of targets) {
    const jsonPath = path.join(localesDir, lang, 'translation.json');
    if (!fs.existsSync(jsonPath)) continue;
    
    const content = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    if (!content.products) {
      content.products = {};
    }
    
    if (lang === 'en') {
      // Merge English values
      content.products = { ...content.products, ...newEnTranslations };
    } else {
      console.log(`Translating keys for ${lang}...`);
      const translatedObj = await translateObject(newEnTranslations, lang);
      // Merge translated values
      content.products = { ...content.products, ...translatedObj };
    }
    
    fs.writeFileSync(jsonPath, JSON.stringify(content, null, 2), 'utf8');
    console.log(`Updated ${lang}/translation.json`);
  }
  console.log('Done!');
}

run().catch(console.error);
