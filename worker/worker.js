const ALLOWED_ORIGIN = "https://kodika91.github.io";

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin",
});

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tasks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          problem: { type: "string" },
          steps: {
            type: "array",
            minItems: 1,
            items: {
              type: "array",
              minItems: 2,
              maxItems: 2,
              items: { type: "string" }
            }
          }
        },
        required: ["name", "problem", "steps"]
      }
    }
  },
  required: ["tasks"]
};

function json(data, status = 200, origin = ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
    },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || ALLOWED_ORIGIN;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/solve") {
      return json({ error: "Not found" }, 404, origin);
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: "OPENAI_API_KEY nincs beállítva a Workerben." }, 500, origin);
    }

    try {
      const body = await request.json();
      const image = body?.image;
      if (typeof image !== "string" || !image.startsWith("data:image/")) {
        return json({ error: "Érvénytelen kép." }, 400, origin);
      }
      if (image.length > 11_000_000) {
        return json({ error: "A kép túl nagy. Készíts kisebb felbontású fotót." }, 413, origin);
      }

      const prompt = `Olvasd ki a fotón látható összes matematikai feladatot, majd oldd meg őket lépésről lépésre magyarul.\n\nSzabályok:\n- A feladatokat a képen látható sorrendben add vissza.\n- Ha több feladat van, mindegyik külön task legyen.\n- A problem mező a lehető legpontosabb átirat legyen.\n- A steps mező minden eleme pontosan két sztring: [címke, kijelzendő levezetési sor].\n- Ha új képlet szükséges, a címke kezdődjön így: \"ÚJ KÉPLET · \".\n- Az utolsó lépés címkéje kezdődjön így: \"KÉSZ · Végeredmény\".\n- Ne hagyj ki algebrai lépéseket, de egy sor legyen rövid, hogy telefonos számológép-kijelzőn elférjen.\n- Ha egy rész nem olvasható biztosan, ne találj ki adatot; a problem mezőben jelezd: [nem olvasható], és a levezetésben is jelezd a bizonytalanságot.`;

      const apiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || "gpt-5.6-terra",
          store: false,
          reasoning: { effort: "medium" },
          input: [{
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: image, detail: "high" }
            ]
          }],
          text: {
            format: {
              type: "json_schema",
              name: "calculator_math_tasks",
              strict: true,
              schema
            }
          }
        })
      });

      const raw = await apiResponse.json();
      if (!apiResponse.ok) {
        return json({ error: raw?.error?.message || "OpenAI API hiba." }, apiResponse.status, origin);
      }

      let outputText = raw.output_text;
      if (!outputText && Array.isArray(raw.output)) {
        for (const item of raw.output) {
          if (item?.type === "message" && Array.isArray(item.content)) {
            const part = item.content.find(x => x?.type === "output_text");
            if (part?.text) { outputText = part.text; break; }
          }
        }
      }

      if (!outputText) {
        return json({ error: "Az AI nem adott feldolgozható választ." }, 502, origin);
      }

      const parsed = JSON.parse(outputText);
      if (!parsed?.tasks?.length) {
        return json({ error: "Nem találtam matematikai feladatot a képen." }, 422, origin);
      }

      return json(parsed, 200, origin);
    } catch (error) {
      return json({ error: error?.message || "Ismeretlen szerverhiba." }, 500, origin);
    }
  }
};
