import { montarSofia } from "./agent/montar.js";
import { criarRegistroArquivo } from "./agent/registro-log.js";
import { criarApp } from "./app.js";
import { carregarCatalogo } from "./catalogo/catalogo.js";
import { lerConfigGemini, ouEncerrar } from "./config.js";
import { criarStoreSessoes } from "./sessao/store.js";

const { apiKey, modelo } = ouEncerrar(() => lerConfigGemini());
const catalogo = carregarCatalogo();
const agente = montarSofia({ apiKey, modelo, catalogo, registro: criarRegistroArquivo() });
const app = criarApp({ agente, store: criarStoreSessoes(), catalogo, logger: true });

const porta = Number(process.env.PORT ?? 3000);
await app.listen({ port: porta, host: "127.0.0.1" });
app.log.info(`Sofia no ar com ${modelo} e ${catalogo.produtos.length} produtos.`);
