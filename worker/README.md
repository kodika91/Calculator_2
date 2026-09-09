# Calculator AI backend

Ez a Cloudflare Worker fogadja a számológépből érkező fotót, elküldi az OpenAI Responses API-nak, majd a számológép által közvetlenül kezelhető `tasks` JSON-t ad vissza.

## Telepítés

1. Cloudflare Dashboard → Workers & Pages → Create Worker.
2. A `worker.js` tartalmát használd Worker kódként, vagy Wranglerrel deployold ezt a mappát.
3. Worker → Settings → Variables and Secrets → Add → **Secret**.
4. Név: `OPENAI_API_KEY`, érték: a saját OpenAI API kulcsod.
5. Deploy.
6. Másold ki a Worker URL-jét, például: `https://calculator-ai-solver.<account>.workers.dev`.
7. A számológépet egyszer nyisd meg így:
   `https://kodika91.github.io/Calculator_2/?api=https://calculator-ai-solver.<account>.workers.dev/solve`
   Az oldal elmenti az endpointot a készüléken, ezért ezt csak egyszer kell megtenni.

Az API-kulcsot soha ne tedd az `index.html`-be vagy GitHub fájlba. A Workerben `Secret` típusú változóként maradjon.
