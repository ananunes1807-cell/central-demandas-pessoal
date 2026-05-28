const STORAGE_KEY = "central-demandas-itens";
const THEME_KEY = "central-demandas-tema";

const STATUSES = ["Caixa de entrada", "Fazendo agora", "Aguardando", "Finalizado"];
const LEGACY_STATUS = {
  Novo: "Caixa de entrada",
  "Em andamento": "Fazendo agora",
  Aguardando: "Aguardando",
  Finalizado: "Finalizado"
};

const DEFAULT_DEMAND = {
  descricao: "",
  setor: "",
  categoria: "Outros",
  prioridade: "Média",
  status: "Caixa de entrada",
  observacoesTecnicas: "",
  feito: "",
  proximoPasso: "",
  historico: []
};

const quickForm = document.querySelector("#quick-form");
const quickTitleInput = document.querySelector("#quick-title-input");
const demandForm = document.querySelector("#demand-form");
const editPanel = document.querySelector("#edit-panel");
const board = document.querySelector("#kanban-board");
const totalDemandas = document.querySelector("#total-demandas");
const doingCount = document.querySelector("#doing-count");
const backupStatus = document.querySelector("#backup-status");
const searchInput = document.querySelector("#search-input");
const statusFilter = document.querySelector("#status-filter");
const categoryFilter = document.querySelector("#category-filter");
const priorityFilter = document.querySelector("#priority-filter");
const cancelEditButton = document.querySelector("#cancel-edit-button");
const duplicateEditButton = document.querySelector("#duplicate-edit-button");
const themeToggle = document.querySelector("#theme-toggle");
const exportButton = document.querySelector("#export-button");
const exportClearButton = document.querySelector("#export-clear-button");
const mergeInput = document.querySelector("#merge-input");
const replaceInput = document.querySelector("#replace-input");
const timelineList = document.querySelector("#timeline-list");
const toast = document.querySelector("#toast");

let demandas = loadDemandas();
let editingDemandId = null;

applySavedTheme();
renderBoard();
registerServiceWorker();

quickForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const titulo = quickTitleInput.value.trim();

  if (!titulo) {
    return;
  }

  demandas.unshift(createDemand({ titulo }));
  saveDemandas();
  renderBoard();
  quickForm.reset();
  quickTitleInput.focus();
  showToast("Demanda anotada na caixa de entrada");
});

demandForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!editingDemandId) {
    return;
  }

  const formValues = getFormValues();

  demandas = demandas.map((demanda) => {
    if (demanda.id !== editingDemandId) {
      return demanda;
    }

    return updateDemandWithHistory(demanda, formValues);
  });

  saveDemandas();
  renderBoard();
  openEditPanel(editingDemandId);
  showToast("Alterações salvas");
});

[searchInput, statusFilter, categoryFilter, priorityFilter].forEach((field) => {
  field.addEventListener("input", renderBoard);
});

cancelEditButton.addEventListener("click", closeEditPanel);

duplicateEditButton.addEventListener("click", () => {
  if (editingDemandId) {
    copyDemand(editingDemandId);
    closeEditPanel();
  }
});

themeToggle.addEventListener("click", () => {
  const nextTheme = document.body.classList.toggle("light-mode") ? "light" : "dark";

  localStorage.setItem(THEME_KEY, nextTheme);
  updateThemeButton();
});

exportButton.addEventListener("click", exportBackup);
exportClearButton.addEventListener("click", exportAndAskToClear);
mergeInput.addEventListener("change", (event) => importBackup(event, "merge"));
replaceInput.addEventListener("change", (event) => importBackup(event, "replace"));

board.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  const card = button.closest("[data-id]");

  if (!card) {
    return;
  }

  const id = card.dataset.id;
  const action = button.dataset.action;

  if (action === "edit") {
    openEditPanel(id);
  }

  if (action === "copy") {
    copyDemand(id);
  }

  if (action === "summary") {
    copySummary(id);
  }

  if (action === "delete") {
    deleteDemand(id);
  }

  if (action === "status") {
    changeStatus(id, button.dataset.status);
  }
});

function createDemand(values) {
  const now = new Date().toISOString();
  const demand = {
    ...DEFAULT_DEMAND,
    ...values,
    id: createId(),
    status: normalizeStatus(values.status || DEFAULT_DEMAND.status),
    data: values.data || getToday(),
    criadaEm: now,
    atualizadaEm: now,
    finalizadaEm: values.status === "Finalizado" ? now : null,
    historico: []
  };

  demand.historico = [createHistoryItem("Demanda criada")];
  return demand;
}

function loadDemandas() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved);
    const demandList = Array.isArray(parsed) ? parsed : parsed.demandas;

    return Array.isArray(demandList) ? demandList.map(normalizeDemand) : [];
  } catch {
    return [];
  }
}

function normalizeDemand(demanda) {
  const createdAt = demanda.criadaEm || new Date().toISOString();
  const status = normalizeStatus(demanda.status);
  const oldTechnical = demanda.tecnico || demanda.observacoesTecnicas || "";
  const oldDone = demanda.feito || demanda.tecnico || "";
  const history = Array.isArray(demanda.historico) ? demanda.historico : [];

  return {
    ...DEFAULT_DEMAND,
    ...demanda,
    titulo: demanda.titulo || "Sem título",
    status,
    data: demanda.data || getToday(),
    criadaEm: createdAt,
    atualizadaEm: demanda.atualizadaEm || createdAt,
    finalizadaEm: demanda.finalizadaEm || null,
    observacoesTecnicas: oldTechnical,
    feito: oldDone,
    proximoPasso: demanda.proximoPasso || "",
    historico: history.length
      ? history.map(normalizeHistoryItem)
      : [createHistoryItem("Demanda criada", createdAt)]
  };
}

function normalizeStatus(status) {
  return LEGACY_STATUS[status] || (STATUSES.includes(status) ? status : "Caixa de entrada");
}

function saveDemandas() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demandas));
}

function renderBoard() {
  const filteredDemandas = getFilteredDemandas();
  const doingNowCount = filteredDemandas.filter(
    (demanda) => demanda.status === "Fazendo agora"
  ).length;

  totalDemandas.textContent = demandas.length;
  doingCount.textContent = doingNowCount;
  backupStatus.textContent = "OK";
  board.innerHTML = STATUSES.map((status) => {
    const columnDemandas = filteredDemandas.filter((demanda) => demanda.status === status);
    const isDoingNow = status === "Fazendo agora";

    return `
      <section class="kanban-column ${isDoingNow ? "focus-column" : ""}" aria-labelledby="column-${slugify(status)}">
        <header class="column-header">
          <div>
            <h2 id="column-${slugify(status)}">
              ${getStatusIcon(status)}
              ${status}
            </h2>
            ${
              isDoingNow
                ? `<p class="column-hint ${doingNowCount > 3 ? "is-alert" : ""}">Ideal: 1 a 3 demandas</p>`
                : ""
            }
          </div>
          <span>${columnDemandas.length}</span>
        </header>
        <div class="column-list">
          ${
            columnDemandas.length
              ? columnDemandas.map(createDemandCard).join("")
              : createEmptyState()
          }
        </div>
      </section>
    `;
  }).join("");
}

function getFilteredDemandas() {
  const search = normalizeText(searchInput.value);
  const selectedStatus = statusFilter.value;
  const selectedCategory = categoryFilter.value;
  const selectedPriority = priorityFilter.value;

  return demandas.filter((demanda) => {
    const text = normalizeText(
      [
        demanda.titulo,
        demanda.setor,
        demanda.categoria,
        demanda.prioridade,
        demanda.status,
        demanda.descricao,
        demanda.observacoesTecnicas,
        demanda.feito,
        demanda.proximoPasso
      ].join(" ")
    );

    return (
      (!search || text.includes(search)) &&
      (selectedStatus === "Todas" || demanda.status === selectedStatus) &&
      (selectedCategory === "Todas" || demanda.categoria === selectedCategory) &&
      (selectedPriority === "Todas" || demanda.prioridade === selectedPriority)
    );
  });
}

function createDemandCard(demanda) {
  const priorityClass = `priority-${slugify(demanda.prioridade)}`;
  const copyBadge = demanda.copiadaDe ? '<span class="copy-badge">Cópia</span>' : "";
  const notes = demanda.descricao || demanda.feito || demanda.proximoPasso || "Sem observações.";
  const previousStatus = getRelativeStatus(demanda.status, -1);
  const nextStatus = getRelativeStatus(demanda.status, 1);

  return `
    <article class="demand-card ${priorityClass}" data-id="${demanda.id}">
      <div class="card-top">
        <div class="card-badges">
          <span>${escapeHtml(demanda.categoria)}</span>
          <span>${escapeHtml(demanda.prioridade)}</span>
          ${copyBadge}
        </div>
        <button class="icon-button" type="button" data-action="edit" title="Editar demanda">Editar</button>
      </div>

      <h3>${escapeHtml(demanda.titulo)}</h3>
      <p class="card-note">${escapeHtml(notes)}</p>

      <dl class="card-meta">
        <div>
          <dt>Setor</dt>
          <dd>${escapeHtml(demanda.setor || "Sem setor")}</dd>
        </div>
        <div>
          <dt>Criada</dt>
          <dd>${formatDateTime(demanda.criadaEm)}</dd>
        </div>
        <div>
          <dt>Atualizada</dt>
          <dd>${formatDateTime(demanda.atualizadaEm)}</dd>
        </div>
      </dl>

      ${demanda.proximoPasso ? `<p class="next-step">Próximo: ${escapeHtml(demanda.proximoPasso)}</p>` : ""}

      <div class="status-actions">
        ${
          previousStatus
            ? `<button type="button" data-action="status" data-status="${previousStatus}">Voltar</button>`
            : ""
        }
        ${
          nextStatus
            ? `<button type="button" data-action="status" data-status="${nextStatus}">Avançar</button>`
            : ""
        }
      </div>

      <div class="card-actions">
        <button type="button" data-action="summary">Copiar resumo</button>
        <button type="button" data-action="copy">Copiar</button>
        <button class="delete-button" type="button" data-action="delete">Excluir</button>
      </div>
    </article>
  `;
}

function openEditPanel(id) {
  const demanda = demandas.find((item) => item.id === id);

  if (!demanda) {
    return;
  }

  editingDemandId = id;
  demandForm.titulo.value = demanda.titulo;
  demandForm.setor.value = demanda.setor;
  demandForm.categoria.value = demanda.categoria;
  demandForm.prioridade.value = demanda.prioridade;
  demandForm.status.value = demanda.status;
  demandForm.data.value = demanda.data;
  demandForm.descricao.value = demanda.descricao;
  demandForm.observacoesTecnicas.value = demanda.observacoesTecnicas;
  demandForm.feito.value = demanda.feito;
  demandForm.proximoPasso.value = demanda.proximoPasso;
  renderTimeline(demanda);

  editPanel.hidden = false;
  editPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  demandForm.titulo.focus();
}

function closeEditPanel() {
  editingDemandId = null;
  demandForm.reset();
  timelineList.innerHTML = "";
  editPanel.hidden = true;
}

function getFormValues() {
  const formData = new FormData(demandForm);

  return {
    titulo: formData.get("titulo").trim(),
    setor: formData.get("setor").trim(),
    categoria: formData.get("categoria"),
    prioridade: formData.get("prioridade"),
    status: formData.get("status"),
    data: formData.get("data") || getToday(),
    descricao: formData.get("descricao").trim(),
    observacoesTecnicas: formData.get("observacoesTecnicas").trim(),
    feito: formData.get("feito").trim(),
    proximoPasso: formData.get("proximoPasso").trim()
  };
}

function updateDemandWithHistory(demanda, formValues) {
  const now = new Date().toISOString();
  const historyMessages = getChangeMessages(demanda, formValues);
  const historico = [...demanda.historico];

  historyMessages.forEach((message) => {
    historico.unshift(createHistoryItem(message, now));
  });

  return {
    ...demanda,
    ...formValues,
    finalizadaEm: resolveFinalizedDate(demanda, formValues.status),
    atualizadaEm: now,
    historico
  };
}

function getChangeMessages(oldDemand, nextDemand) {
  const messages = [];

  if (oldDemand.status !== nextDemand.status) {
    messages.push(`Status alterado para ${nextDemand.status}`);
  }

  if (oldDemand.feito !== nextDemand.feito) {
    messages.push("O que já foi feito foi atualizado");
  }

  if (oldDemand.observacoesTecnicas !== nextDemand.observacoesTecnicas) {
    messages.push("Observações técnicas atualizadas");
  }

  if (oldDemand.proximoPasso !== nextDemand.proximoPasso) {
    messages.push("Próximo passo atualizado");
  }

  if (oldDemand.descricao !== nextDemand.descricao) {
    messages.push("Descrição atualizada");
  }

  if (
    oldDemand.titulo !== nextDemand.titulo ||
    oldDemand.setor !== nextDemand.setor ||
    oldDemand.categoria !== nextDemand.categoria ||
    oldDemand.prioridade !== nextDemand.prioridade ||
    oldDemand.data !== nextDemand.data
  ) {
    messages.push("Dados principais atualizados");
  }

  return messages.length ? messages : ["Demanda revisada"];
}

function changeStatus(id, status) {
  let finished = false;

  demandas = demandas.map((demanda) => {
    if (demanda.id !== id) {
      return demanda;
    }

    const now = new Date().toISOString();
    finished = status === "Finalizado";

    return {
      ...demanda,
      status,
      finalizadaEm: resolveFinalizedDate(demanda, status),
      atualizadaEm: now,
      historico: [
        createHistoryItem(`Status alterado para ${status}`, now),
        ...demanda.historico
      ]
    };
  });

  saveDemandas();
  renderBoard();
  showToast(finished ? "Demanda concluída" : `Movida para ${status}`);
}

function copyDemand(id) {
  const demanda = demandas.find((item) => item.id === id);

  if (!demanda) {
    return;
  }

  demandas.unshift(
    createDemand({
      ...demanda,
      id: undefined,
      titulo: `Cópia de: ${demanda.titulo}`,
      status: "Caixa de entrada",
      data: getToday(),
      copiadaDe: demanda.id,
      finalizadaEm: null
    })
  );

  saveDemandas();
  renderBoard();
  showToast("Cópia criada na caixa de entrada");
}

function copySummary(id) {
  const demanda = demandas.find((item) => item.id === id);

  if (!demanda) {
    return;
  }

  const summary = [
    `Demanda: ${demanda.titulo}`,
    `Setor: ${demanda.setor || "Não informado"}`,
    `Categoria: ${demanda.categoria}`,
    `Prioridade: ${demanda.prioridade}`,
    `Status: ${demanda.status}`,
    `O que já foi feito: ${demanda.feito || "Não informado"}`,
    `Próximo passo: ${demanda.proximoPasso || "Não informado"}`
  ].join("\n");

  copyText(summary);
}

function deleteDemand(id) {
  const demanda = demandas.find((item) => item.id === id);

  if (!demanda || !confirm(`Excluir "${demanda.titulo}"?`)) {
    return;
  }

  demandas = demandas.filter((item) => item.id !== id);
  saveDemandas();
  renderBoard();
  showToast("Demanda excluída");

  if (editingDemandId === id) {
    closeEditPanel();
  }
}

function renderTimeline(demanda) {
  timelineList.innerHTML = demanda.historico
    .map(
      (item) => `
        <li>
          <time>${formatDateTime(item.em)}</time>
          <span>${escapeHtml(item.texto)}</span>
        </li>
      `
    )
    .join("");
}

function exportBackup() {
  downloadBackup();
  showToast("Backup exportado");
}

function exportAndAskToClear() {
  if (!demandas.length) {
    showToast("Não há demandas para exportar");
    return;
  }

  downloadBackup();

  window.setTimeout(() => {
    const shouldClear = confirm(
      "Backup baixado. Deseja apagar as demandas deste aparelho agora?\n\nUse isso apenas depois de guardar ou enviar o arquivo JSON."
    );

    if (!shouldClear) {
      showToast("Demandas mantidas neste aparelho");
      return;
    }

    demandas = [];
    saveDemandas();
    closeEditPanel();
    renderBoard();
    showToast("Demandas apagadas deste aparelho");
  }, 300);
}

function downloadBackup() {
  const backup = {
    app: "Central de Demandas",
    versao: 3,
    exportadoEm: new Date().toISOString(),
    firebasePronto: {
      auth: false,
      firestore: false,
      storage: false
    },
    demandas
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = `central-demandas-${getToday()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importBackup(event, mode) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const importedDemandas = Array.isArray(data) ? data : data.demandas;

      if (!Array.isArray(importedDemandas)) {
        throw new Error("Formato inválido");
      }

      const normalizedImported = importedDemandas.map(normalizeDemand);

      if (mode === "replace") {
        if (!confirm("Substituir todas as demandas deste aparelho pelo arquivo JSON?")) {
          event.target.value = "";
          return;
        }

        demandas = normalizedImported;
      } else {
        demandas = mergeDemandas(demandas, normalizedImported);
      }

      saveDemandas();
      renderBoard();
      closeEditPanel();
      showToast(mode === "replace" ? "Backup substituído com sucesso" : "Backup mesclado com sucesso");
    } catch {
      showToast("Não foi possível importar este JSON");
    }

    event.target.value = "";
  };

  reader.readAsText(file);
}

function mergeDemandas(currentDemandas, importedDemandas) {
  const merged = new Map();

  currentDemandas.forEach((demanda) => {
    merged.set(demanda.id, demanda);
  });

  importedDemandas.forEach((demanda) => {
    const current = merged.get(demanda.id);

    if (!current) {
      merged.set(demanda.id, demanda);
      return;
    }

    merged.set(demanda.id, pickNewestDemand(current, demanda));
  });

  return Array.from(merged.values()).sort((a, b) => {
    return new Date(b.atualizadaEm || b.criadaEm) - new Date(a.atualizadaEm || a.criadaEm);
  });
}

function pickNewestDemand(current, imported) {
  const currentDate = new Date(current.atualizadaEm || current.criadaEm).getTime();
  const importedDate = new Date(imported.atualizadaEm || imported.criadaEm).getTime();

  return importedDate > currentDate ? imported : current;
}

function resolveFinalizedDate(demanda, nextStatus) {
  if (nextStatus === "Finalizado") {
    return demanda.finalizadaEm || new Date().toISOString();
  }

  return null;
}

function getRelativeStatus(status, direction) {
  const index = STATUSES.indexOf(status);
  const nextIndex = index + direction;

  return STATUSES[nextIndex] || "";
}

function getFinalizedLabel(demanda) {
  if (demanda.finalizadaEm) {
    return formatDateTime(demanda.finalizadaEm);
  }

  return demanda.status === "Finalizado" ? "Sem registro" : "Em aberto";
}

function createHistoryItem(texto, em = new Date().toISOString()) {
  return { id: createId(), texto, em };
}

function normalizeHistoryItem(item) {
  if (typeof item === "string") {
    return createHistoryItem(item);
  }

  return {
    id: item.id || createId(),
    texto: item.texto || item.message || "Registro atualizado",
    em: item.em || item.createdAt || new Date().toISOString()
  };
}

function formatDateTime(date) {
  if (!date) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(date));
}

function getToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `demanda-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast("Resumo copiado"));
    return;
  }

  const textarea = document.createElement("textarea");

  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
  showToast("Resumo copiado");
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;

  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

function applySavedTheme() {
  const theme = localStorage.getItem(THEME_KEY);

  if (theme === "light") {
    document.body.classList.add("light-mode");
  }

  updateThemeButton();
}

function updateThemeButton() {
  themeToggle.textContent = document.body.classList.contains("light-mode")
    ? "Cyber Cat"
    : "Cozy Cat";
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, "-");
}

function getStatusIcon(status) {
  const icons = {
    "Caixa de entrada": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15h4l2 3h4l2-3h4"/><path d="M5 15 7 8h10l2 7"/><path d="M12 5v6"/><path d="m9 8 3-3 3 3"/></svg>',
    "Fazendo agora": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2 4 13h7l-1 9 10-12h-7l.5-8Z"/></svg>',
    Aguardando: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10"/><path d="M7 21h10"/><path d="M8 3c0 5 8 5 8 9s-8 4-8 9"/><path d="M16 3c0 5-8 5-8 9s8 4 8 9"/></svg>',
    Finalizado: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>'
  };

  return icons[status] || "";
}

function createEmptyState() {
  return `
    <div class="empty-column">
      <svg class="empty-cat" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M18 30 14 18l12 7h12l12-7-4 12" />
        <path d="M18 30c0 11 7 18 14 18s14-7 14-18" />
        <path d="M25 35h.1M39 35h.1" />
        <path d="M30 40c1.5 1.2 2.5 1.2 4 0" />
        <path d="M10 45c6 4 11 4 16 1M54 45c-6 4-11 4-16 1" />
      </svg>
      <span>Tudo tranquilo por enquanto</span>
    </div>
  `;
}

// Evita que textos digitados sejam interpretados como HTML ao renderizar cards.
function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js");
    });
  }
}
