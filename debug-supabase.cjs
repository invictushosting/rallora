const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

function loadEnv() {
  const text = fs.readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return env;
}

async function main() {
  const env = loadEnv();

  console.log("Supabase URL present:", Boolean(env.NEXT_PUBLIC_SUPABASE_URL));
  console.log("Supabase key present:", Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  console.log("Supabase URL:", env.NEXT_PUBLIC_SUPABASE_URL);

  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const tests = [
    ["seasons", supabase.from("seasons").select("id,name,status").limit(5)],
    ["divisions", supabase.from("divisions").select("id,name,sort_order").limit(5)],
    ["teams", supabase.from("teams").select("id,name").limit(5)],
    ["standings", supabase.from("standings").select("id,played,points").limit(5)],
    ["fixtures", supabase.from("fixtures").select("id,week_number,status").limit(5)],
  ];

  for (const [name, query] of tests) {
    const { data, error } = await query;
    console.log("\nTABLE:", name);
    if (error) {
      console.log("ERROR:", error.message);
      console.log(error);
    } else {
      console.log("OK rows:", data.length);
      console.log(data);
    }
  }
}

main().catch(console.error);
