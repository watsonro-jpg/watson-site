const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const results = [];
const ok = (name, cond, detail) => results.push({ name, ok: !!cond, detail });

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  url: "http://localhost/",
  pretendToBeVisual: true,
});
const { window } = dom;
const doc = window.document;

// captura chamadas a window.open sem realmente abrir nada
let openedUrl = null;
window.open = (url) => {
  openedUrl = url;
  return null;
};

// 1) Todos os links internos (#algo) apontam para um id que existe
const internalLinks = [...doc.querySelectorAll('a[href^="#"]')];
internalLinks.forEach((a) => {
  const id = a.getAttribute("href").slice(1);
  const target = doc.getElementById(id);
  ok(`Link "${a.textContent.trim()}" -> #${id}`, !!target, target ? "elemento encontrado" : "ID não existe no documento");
});

// 2) Botão "Contratar no WhatsApp" (footer)
const ctaBtn = doc.querySelector(".cta__button");
ok("Botão 'Contratar no WhatsApp' existe", !!ctaBtn);
if (ctaBtn) {
  const href = ctaBtn.getAttribute("href");
  ok("Link do WhatsApp usa wa.me com número correto", href.startsWith("https://wa.me/5582999679207"), href);
  ok("Abre em nova aba (target=_blank)", ctaBtn.getAttribute("target") === "_blank");
  ok("Usa rel=noopener noreferrer (segurança)", (ctaBtn.getAttribute("rel") || "").includes("noopener"));
}

// 3) Formulário de reserva: preencher e simular envio
const form = doc.getElementById("reserve-form");
ok("Formulário de reserva existe", !!form);

form.elements.nome.value = "Maria Silva";
form.elements.telefone.value = "(82) 99999-1234";
form.elements.pessoas.value = "3";
form.elements.data.value = "2026-10-05";

const submitEvent = new window.Event("submit", { bubbles: true, cancelable: true });
form.dispatchEvent(submitEvent);

ok("Envio do formulário não recarrega a página (preventDefault)", submitEvent.defaultPrevented);
ok("Envio do formulário chamou window.open (abriu o WhatsApp)", !!openedUrl);

if (openedUrl) {
  const decoded = decodeURIComponent(openedUrl.split("text=")[1] || "");
  ok("URL aponta para o número correto", openedUrl.startsWith("https://wa.me/5582999679207"), openedUrl.split("?")[0]);
  ok("Mensagem contém o nome digitado", decoded.includes("Maria Silva"));
  ok("Mensagem contém o telefone digitado", decoded.includes("(82) 99999-1234"));
  ok("Mensagem contém o número de pessoas", decoded.includes("Número de pessoas: 3"));
  ok("Mensagem contém a data formatada em pt-BR", decoded.includes("05/10/2026"), decoded);
}

// 4) Campos obrigatórios do formulário
["nome", "telefone", "pessoas", "data"].forEach((field) => {
  const el = form.elements[field];
  ok(`Campo "${field}" é obrigatório (required)`, el && el.required);
});

// 5) Texto do menu renomeado
const navMenuLink = [...doc.querySelectorAll(".site-nav a")].find(a => a.getAttribute("href") === "#menu");
ok('Link do menu no nav mostra "Linguagem de Programação"', navMenuLink && navMenuLink.textContent.trim() === "Linguagem de Programação", navMenuLink && navMenuLink.textContent.trim());

const menuTitle = doc.querySelector("#menu .section__title");
ok('Título da seção de menu não usa mais "cardápio"', menuTitle && !menuTitle.textContent.toLowerCase().includes("cardap"), menuTitle && menuTitle.textContent.trim());

// print results
let allOk = true;
for (const r of results) {
  if (!r.ok) allOk = false;
  console.log(`${r.ok ? "OK " : "FALHA"} - ${r.name}${r.detail ? " :: " + r.detail : ""}`);
}
console.log("\n" + (allOk ? "TODOS OS TESTES PASSARAM" : "ALGUM TESTE FALHOU"));
