#!/usr/bin/env node
// Gera as imagens das fichas (Google Play e App Store) a partir das capturas reais.
// Uso: node docs/lojas/ferramentas/gerar-imagens.mjs
// Requisitos: Google Chrome (modo headless) e ffmpeg no PATH. Sem dependências npm.
// Cores: só as de DESIGN_TOKENS.md (Primary #00852A, Brand #00C853) e branco. Fonte: Poppins do app.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const lojas = path.resolve(aqui, "..");
const raiz = path.resolve(lojas, "..", "..");
const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const u = (p) => pathToFileURL(p).href;
const fonte = (peso, arq) =>
  `@font-face{font-family:Poppins;font-weight:${peso};src:url("${u(path.join(raiz, "app/src/main/res/font", arq))}")}`;
const BASE = `${fonte(400, "poppins_regular.ttf")}${fonte(600, "poppins_semibold.ttf")}${fonte(700, "poppins_bold.ttf")}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden}
body{font-family:Poppins,sans-serif;background:#00852A;color:#fff}`;
const ICONE = path.join(raiz, "app/src/main/ic_launcher-playstore.png");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "futeba-fichas-"));

function render(html, w, h, saida) {
  const arq = path.join(tmp, path.basename(saida) + ".html");
  const bruto = path.join(tmp, path.basename(saida) + ".raw.png");
  fs.writeFileSync(arq, `<!doctype html><meta charset="utf-8"><style>${BASE}</style>${html}`);
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    `--user-data-dir=${path.join(tmp, "perfil")}`, `--window-size=${w},${h}`, `--screenshot=${bruto}`, u(arq)], { stdio: "ignore" });
  // PNG de 24 bits, sem alfa (exigência da imagem de destaque do Play; vale para todas).
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", bruto, "-vf", `crop=${w}:${h}:0:0`, "-pix_fmt", "rgb24", saida]);
  console.log("ok", path.relative(raiz, saida));
}

// Captura com legenda: título em cima, tela real embaixo, inteira.
function legenda({ titulo, sub, img, w, h, saida }) {
  const k = w / 1080;
  render(`<style>
  .t{position:absolute;top:${88 * k}px;left:${60 * k}px;right:${60 * k}px;text-align:center}
  h1{font-weight:700;font-size:${68 * k}px;line-height:1.12;letter-spacing:-${1 * k}px}
  p{font-weight:400;font-size:${34 * k}px;margin-top:${14 * k}px;opacity:.92}
  .f{position:absolute;left:50%;transform:translateX(-50%);bottom:${44 * k}px;height:${h - 400 * k}px;
     border-radius:${44 * k}px;border:${10 * k}px solid #fff;overflow:hidden;background:#fff;box-shadow:0 ${16 * k}px ${50 * k}px rgba(0,0,0,.28)}
  .f img{height:100%;display:block}
  </style><div class="t"><h1>${titulo}</h1><p>${sub}</p></div><div class="f"><img src="${u(img)}"></div>`, w, h, saida);
}

const gp = path.join(lojas, "google-play");
const telefone = [
  ["telefone-01-home.png", "Sua pelada organizada", "Jogos, gols e nível em uma tela só"],
  ["telefone-02-home_conf.png", "Confirme sua presença", "Veja quem vai e os jogos da região"],
  ["telefone-03-grupo.png", "Reúna os parças no grupo", "Convide, organize e crie o jogo"],
  ["telefone-04-ranking.png", "Ranking da galera", "Gols, assistências, defesas e MVP"],
  ["telefone-05-perfil.png", "Evolua de nível a cada jogo", "Suas estatísticas e avaliações por posição"],
  ["telefone-06-criar.png", "Crie o jogo e chame o grupo", "Local, data, horário e vagas"],
];
telefone.forEach(([arq, titulo, sub], i) =>
  legenda({ titulo, sub, img: path.join(gp, "brutas", arq), w: 1080, h: 1920,
    saida: path.join(gp, "telefone", `0${i + 1}-${arq.replace(/^telefone-\d+-|\.png$/g, "")}.png`) }));

// Imagem de destaque do Play, 1024 x 500.
render(`<style>
 .e{position:absolute;left:56px;top:0;bottom:0;width:520px;display:flex;flex-direction:column;justify-content:center}
 .e img{width:96px;height:96px;border-radius:22px;border:4px solid #fff}
 h1{font-weight:700;font-size:54px;line-height:1.08;margin-top:22px;letter-spacing:-1px}
 p{font-size:25px;margin-top:12px;opacity:.94}
 .c{position:absolute;top:44px;height:560px;border-radius:26px;border:6px solid #fff;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,.3);background:#fff}
 .c img{height:100%;display:block}
 </style><div class="e"><img src="${u(ICONE)}"><h1>Futeba dos Parças</h1><p>Jogos, grupos e ranking da sua pelada</p></div>
 <div class="c" style="left:590px"><img src="${u(path.join(gp, "brutas", "telefone-01-home.png"))}"></div>
 <div class="c" style="left:800px;top:84px"><img src="${u(path.join(gp, "brutas", "telefone-04-ranking.png"))}"></div>`,
  1024, 500, path.join(gp, "imagem-destaque-1024x500.png"));

// Fundo do vídeo do Play, 1920 x 1080 (a gravação real entra por cima, à direita).
render(`<style>
 .e{position:absolute;left:120px;top:0;bottom:0;width:1050px;display:flex;flex-direction:column;justify-content:center}
 .e img{width:150px;height:150px;border-radius:34px;border:6px solid #fff}
 h1{font-weight:700;font-size:104px;line-height:1.05;margin-top:36px;letter-spacing:-2px}
 p{font-size:46px;margin-top:22px;opacity:.94}
 li{font-size:40px;margin-top:20px;list-style:none;font-weight:600}
 li:before{content:"";display:inline-block;width:18px;height:18px;border-radius:9px;background:#00C853;margin-right:20px}
 ul{margin-top:36px}
 </style><div class="e"><img src="${u(ICONE)}"><h1>Futeba dos Parças</h1><p>Sua pelada organizada</p>
 <ul><li>Crie o jogo e confirme presença</li><li>Grupos com os seus parças</li><li>Ranking, estatísticas e níveis</li></ul></div>`,
  1920, 1080, path.join(gp, "video", "fundo-1920x1080.png"));

// App Store, iPhone 6,9" (1320 x 2868), sobre as capturas reais do iPhone já publicadas.
const ios = path.join(lojas, "backup-20261114", "app-store", "capturas");
[
  ["03-criar-jogo.png", "Crie o jogo em minutos", "Quadra, data, horário e vagas"],
  ["04-grupos.png", "Reúna os parças no grupo", "Convites, jogos da rodada e caixa"],
  ["05-perfil.png", "Ranking, conquistas e estatísticas", "Tudo do seu futebol no perfil"],
  ["01-entrada.png", "Sua pelada organizada", "Presença, grupos e histórico do jogador"],
].forEach(([arq, titulo, sub], i) =>
  legenda({ titulo, sub, img: path.join(ios, arq), w: 1320, h: 2868,
    saida: path.join(lojas, "app-store", "iphone-6-9", `0${i + 1}-${arq.replace(/^\d+-/, "")}`) }));

fs.rmSync(tmp, { recursive: true, force: true });
