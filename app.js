/* Despensa: inventario local, sin cuentas ni servicios externos. */
(() => {
  "use strict";

  const STORAGE_KEY = "despensa.products.v1";
  const form = document.querySelector("#product-form");
  const idInput = document.querySelector("#product-id");
  const categoryInput = document.querySelector("#category");
  const nameInput = document.querySelector("#name");
  const quantityInput = document.querySelector("#quantity");
  const unitInput = document.querySelector("#unit");
  const expiryInput = document.querySelector("#expiry");
  const saveButton = document.querySelector("#save-button");
  const cancelEditButton = document.querySelector("#cancel-edit");
  const formTitle = document.querySelector("#form-title");
  const formMessage = document.querySelector("#form-message");
  const searchInput = document.querySelector("#search");
  const categoryFilter = document.querySelector("#category-filter");
  const expiryFilter = document.querySelector("#expiry-filter");
  const inventoryList = document.querySelector("#inventory-list");
  const emptyState = document.querySelector("#empty-state");
  const totalCount = document.querySelector("#total-count");
  const listMessage = document.querySelector("#list-message");
  const exportButton = document.querySelector("#export-button");
  const importFile = document.querySelector("#import-file");

  let products = loadProducts();

  function loadProducts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidStoredProduct);
    } catch (error) {
      console.error("No se pudieron leer los datos guardados:", error);
      return [];
    }
  }

  function isValidStoredProduct(item) {
    return item && typeof item.id === "string" &&
      typeof item.name === "string" && typeof item.category === "string" &&
      ["Limpieza", "Higiene personal", "Alimentación"].includes(item.category) &&
      Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0 &&
      ["ud.", "kg", "g", "l", "ml"].includes(item.unit);
  }

  function persistProducts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
      return true;
    } catch (error) {
      console.error("No se pudieron guardar los datos:", error);
      showFormMessage("No se pudieron guardar los datos. Comprueba el espacio disponible en el dispositivo.", true);
      return false;
    }
  }

  function showFormMessage(message, isError = false) {
    formMessage.textContent = message;
    formMessage.style.color = isError ? "#a22d24" : "";
  }

  function showListMessage(message, isError = false) {
    listMessage.textContent = message;
    listMessage.style.color = isError ? "#a22d24" : "";
  }

  function makeId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function formatDate(dateString) {
    if (!dateString) return "";
    const parts = dateString.split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return "";
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit", month: "2-digit", year: "numeric"
    }).format(new Date(parts[0], parts[1] - 1, parts[2]));
  }

  function dateState(dateString) {
    if (!dateString) return { label: "", className: "" };
    const [year, month, day] = dateString.split("-").map(Number);
    const expiry = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
    if (days < 0) return { label: `Caducado el ${formatDate(dateString)}`, className: "expiry-past", days };
    if (days <= 30) {
      const label = days === 0 ? "Caduca hoy" : days === 1 ? "Caduca mañana" : `Caduca en ${days} días`;
      return { label: `${label} · ${formatDate(dateString)}`, className: "expiry-soon", days };
    }
    return { label: `Caduca el ${formatDate(dateString)}`, className: "expiry-ok", days };
  }

  function categorySymbol(category) {
    return category === "Limpieza" ? "🧽" :
      category === "Higiene personal" ? "🧴" : "🥫";
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function render() {
    inventoryList.replaceChildren();
    const query = searchInput.value.trim().toLocaleLowerCase("es");
    const category = categoryFilter.value;
    const expiryMode = expiryFilter.value;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const visibleProducts = products
      .filter(product => product.name.toLocaleLowerCase("es").includes(query))
      .filter(product => category === "Todas" || product.category === category)
      .filter(product => {
        if (expiryMode === "sin-fecha") return !product.expiry;
        if (!product.expiry) return expiryMode === "Todas";
        const state = dateState(product.expiry);
        if (expiryMode === "caducados") return state.days < 0;
        if (expiryMode === "proximos") return state.days >= 0 && state.days <= 30;
        return true;
      })
      .sort((a, b) => {
        if (a.expiry && b.expiry) return a.expiry.localeCompare(b.expiry) || a.name.localeCompare(b.name, "es");
        if (a.expiry) return -1;
        if (b.expiry) return 1;
        return a.name.localeCompare(b.name, "es");
      });

    totalCount.textContent = String(products.length);
    emptyState.classList.toggle("hidden", products.length > 0);
    if (products.length === 0) {
      emptyState.querySelector("h3").textContent = "Tu despensa está vacía";
      emptyState.querySelector("p").textContent = "Añade tu primer producto usando el formulario.";
    } else if (visibleProducts.length === 0) {
      emptyState.classList.remove("hidden");
      emptyState.querySelector("h3").textContent = "No hay resultados";
      emptyState.querySelector("p").textContent = "Prueba con otra búsqueda o cambia los filtros.";
    } else {
      emptyState.classList.add("hidden");
    }

    for (const product of visibleProducts) {
      inventoryList.appendChild(renderProduct(product));
    }
  }

  function renderProduct(product) {
    const card = createElement("article", "product-card");
    const symbol = createElement("div", "product-symbol", categorySymbol(product.category));
    symbol.setAttribute("aria-hidden", "true");
    const main = createElement("div", "product-main");
    const titleRow = createElement("div", "product-title-row");
    titleRow.append(
      createElement("h3", "product-title", product.name),
      createElement("span", "category-tag", product.category)
    );
    const quantityText = `${formatQuantity(product.quantity)} ${product.unit}`;
    main.append(titleRow, createElement("p", "product-meta", quantityText));

    const expiry = dateState(product.expiry);
    if (expiry.label) {
      const expiryTag = createElement("span", `expiry-tag ${expiry.className}`, expiry.label);
      main.appendChild(expiryTag);
    }

    const actions = createElement("div", "product-actions");
    const editButton = createElement("button", "icon-btn", "✎");
    editButton.type = "button";
    editButton.title = `Editar ${product.name}`;
    editButton.setAttribute("aria-label", `Editar ${product.name}`);
    editButton.addEventListener("click", () => startEdit(product.id));

    const deleteButton = createElement("button", "icon-btn delete", "×");
    deleteButton.type = "button";
    deleteButton.title = `Eliminar ${product.name}`;
    deleteButton.setAttribute("aria-label", `Eliminar ${product.name}`);
    deleteButton.addEventListener("click", () => deleteProduct(product.id));

    actions.append(editButton, deleteButton);
    card.append(symbol, main, actions);
    return card;
  }

  function formatQuantity(value) {
    return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(Number(value));
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const quantity = Number(String(quantityInput.value).replace(",", "."));
    if (!name) {
      showFormMessage("Escribe el nombre del producto.", true);
      nameInput.focus();
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      showFormMessage("La cantidad debe ser un número mayor que cero.", true);
      quantityInput.focus();
      return;
    }
    if (expiryInput.value && !/^\d{4}-\d{2}-\d{2}$/.test(expiryInput.value)) {
      showFormMessage("Introduce una fecha válida.", true);
      expiryInput.focus();
      return;
    }

    const id = idInput.value;
    const product = {
      id: id || makeId(),
      category: categoryInput.value,
      name,
      quantity,
      unit: unitInput.value,
      expiry: expiryInput.value || "",
      updatedAt: new Date().toISOString()
    };

    const previous = products;
    if (id) {
      products = products.map(item => item.id === id ? product : item);
    } else {
      products.push({ ...product, createdAt: product.updatedAt });
    }
    if (!persistProducts()) {
      products = previous;
      return;
    }

    resetForm();
    render();
    showFormMessage(id ? "Producto actualizado correctamente." : "Producto guardado correctamente.");
  });

  function startEdit(id) {
    const product = products.find(item => item.id === id);
    if (!product) return;
    idInput.value = product.id;
    categoryInput.value = product.category;
    nameInput.value = product.name;
    quantityInput.value = product.quantity;
    unitInput.value = product.unit;
    expiryInput.value = product.expiry || "";
    formTitle.textContent = "Editar producto";
    saveButton.textContent = "Guardar cambios";
    cancelEditButton.classList.remove("hidden");
    showFormMessage("");
    document.querySelector(".panel").scrollIntoView({ behavior: "smooth", block: "start" });
    nameInput.focus({ preventScroll: true });
  }

  function deleteProduct(id) {
    const product = products.find(item => item.id === id);
    if (!product) return;
    if (!window.confirm(`¿Quieres eliminar «${product.name}» de la despensa?`)) return;
    const previous = products;
    products = products.filter(item => item.id !== id);
    if (!persistProducts()) {
      products = previous;
      return;
    }
    if (idInput.value === id) resetForm();
    render();
    showListMessage(`Se ha eliminado «${product.name}».`);
  }

  function resetForm() {
    form.reset();
    idInput.value = "";
    categoryInput.value = "Alimentación";
    unitInput.value = "ud.";
    formTitle.textContent = "Añadir producto";
    saveButton.textContent = "Guardar producto";
    cancelEditButton.classList.add("hidden");
  }

  cancelEditButton.addEventListener("click", () => {
    resetForm();
    showFormMessage("Edición cancelada.");
  });
  searchInput.addEventListener("input", render);
  categoryFilter.addEventListener("change", render);
  expiryFilter.addEventListener("change", render);

  exportButton.addEventListener("click", () => {
    const backup = {
      app: "Despensa",
      version: 1,
      exportedAt: new Date().toISOString(),
      products
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `despensa-copia-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showListMessage("Copia de seguridad exportada.");
  });

  // Importar es opcional: permite recuperar una copia exportada anteriormente.
  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.className = "btn btn-outline";
  importButton.textContent = "Importar copia";
  importButton.addEventListener("click", () => importFile.click());
  exportButton.insertAdjacentElement("afterend", importButton);

  importFile.addEventListener("change", async () => {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = Array.isArray(parsed) ? parsed : parsed.products;
      if (!Array.isArray(incoming) || !incoming.every(isValidStoredProduct)) {
        throw new Error("El archivo no tiene el formato esperado.");
      }
      if (!window.confirm(`La copia contiene ${incoming.length} productos. ¿Quieres sustituir el inventario actual (${products.length} productos)?`)) {
        importFile.value = "";
        return;
      }
      const previous = products;
      products = incoming.map(item => ({ ...item }));
      if (!persistProducts()) {
        products = previous;
        return;
      }
      resetForm();
      render();
      showListMessage(`Copia recuperada: ${products.length} productos.`);
    } catch (error) {
      showListMessage(`No se pudo importar la copia: ${error.message}`, true);
    } finally {
      importFile.value = "";
    }
  });

  // El aviso de instalación se muestra cuando el navegador lo permite.
  let installPrompt = null;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    const installButton = document.createElement("button");
    installButton.type = "button";
    installButton.className = "btn btn-outline";
    installButton.textContent = "Instalar app";
    installButton.id = "install-button";
    installButton.addEventListener("click", async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      installButton.remove();
    });
    exportButton.insertAdjacentElement("afterend", installButton);
  });

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(error => {
        console.warn("No se pudo registrar el modo sin conexión:", error);
      });
    });
  }

  render();
})();
