/* Despensa compartida: requiere Supabase y las tablas creadas con supabase-schema.sql. */
(() => {
  "use strict";
  const cfg = window.DESPENSA_CONFIG || {};
  const readyConfig = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("PEGA_AQUI") && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("PEGA_AQUI");
  const $ = s => document.querySelector(s);
  const setupPanel = $("#setup-panel"), sharedPanel = $("#shared-panel");
  const authMessage = $("#auth-message"), pantryChoice = $("#pantry-choice");
  const form = $("#product-form"), idInput = $("#product-id"), categoryInput = $("#category"), nameInput = $("#name"), quantityInput = $("#quantity"), unitInput = $("#unit"), expiryInput = $("#expiry");
  const saveButton = $("#save-button"), cancelEditButton = $("#cancel-edit"), formTitle = $("#form-title"), formMessage = $("#form-message");
  const searchInput = $("#search"), categoryFilter = $("#category-filter"), expiryFilter = $("#expiry-filter"), inventoryList = $("#inventory-list"), emptyState = $("#empty-state"), totalCount = $("#total-count"), listMessage = $("#list-message");
  const exportButton = $("#export-button"), importFile = $("#import-file");
  let supabase = null, user = null, pantry = null, products = [], realtimeChannel = null;

  function message(el, text, error = false) { el.textContent = text; el.style.color = error ? "#a22d24" : ""; }
  function makeId() { return crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function escapeText(value) { return String(value ?? ""); }
  function formatQuantity(value) { return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(Number(value)); }
  function formatDate(s) { if (!s) return ""; const [y,m,d] = s.split("-").map(Number); return new Intl.DateTimeFormat("es-ES", { day:"2-digit", month:"2-digit", year:"numeric" }).format(new Date(y,m-1,d)); }
  function dateState(s) {
    if (!s) return { label:"", className:"" };
    const [y,m,d] = s.split("-").map(Number), expiry = new Date(y,m-1,d), today = new Date(); today.setHours(0,0,0,0);
    const days = Math.floor((expiry.getTime()-today.getTime())/86400000);
    if (days < 0) return { label:`Caducado el ${formatDate(s)}`, className:"expiry-past", days };
    if (days <= 30) return { label:`${days===0?"Caduca hoy":days===1?"Caduca mañana":`Caduca en ${days} días`} · ${formatDate(s)}`, className:"expiry-soon", days };
    return { label:`Caduca el ${formatDate(s)}`, className:"expiry-ok", days };
  }
  function categorySymbol(c) { return c === "Limpieza" ? "🧽" : c === "Higiene personal" ? "🧴" : "🥫"; }
  function el(tag, cls, text) { const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=text; return n; }
  function validProduct(p) { return p && typeof p.name === "string" && p.name.trim() && ["Limpieza","Higiene personal","Alimentación"].includes(p.category) && Number.isFinite(Number(p.quantity)) && Number(p.quantity)>0 && ["ud.","kg","g","l","ml"].includes(p.unit); }

  function render() {
    inventoryList.replaceChildren();
    const q = searchInput.value.trim().toLocaleLowerCase("es"), cat = categoryFilter.value, ef = expiryFilter.value;
    const visible = products.filter(p => p.name.toLocaleLowerCase("es").includes(q)).filter(p => cat === "Todas" || p.category === cat).filter(p => {
      if (ef === "sin-fecha") return !p.expiry;
      if (!p.expiry) return ef === "Todas";
      const st=dateState(p.expiry); if(ef==="caducados")return st.days<0; if(ef==="proximos")return st.days>=0&&st.days<=30; return true;
    }).sort((a,b)=>a.expiry&&b.expiry?a.expiry.localeCompare(b.expiry)||a.name.localeCompare(b.name,"es"):a.expiry?-1:b.expiry?1:a.name.localeCompare(b.name,"es"));
    totalCount.textContent=String(products.length);
    if (!products.length) { emptyState.classList.remove("hidden"); emptyState.querySelector("h3").textContent="Tu despensa está vacía"; emptyState.querySelector("p").textContent="Añade tu primer producto usando el formulario."; }
    else if (!visible.length) { emptyState.classList.remove("hidden"); emptyState.querySelector("h3").textContent="No hay resultados"; emptyState.querySelector("p").textContent="Prueba con otra búsqueda o cambia los filtros."; }
    else emptyState.classList.add("hidden");
    visible.forEach(p=>inventoryList.appendChild(renderProduct(p)));
  }
  function renderProduct(p) {
    const card=el("article","product-card"), symbol=el("div","product-symbol",categorySymbol(p.category)), main=el("div","product-main"), titleRow=el("div","product-title-row");
    symbol.setAttribute("aria-hidden","true"); titleRow.append(el("h3","product-title",p.name),el("span","category-tag",p.category));
    main.append(titleRow,el("p","product-meta",`${formatQuantity(p.quantity)} ${p.unit}`));
    const ex=dateState(p.expiry); if(ex.label)main.appendChild(el("span",`expiry-tag ${ex.className}`,ex.label));
    const actions=el("div","product-actions"), edit=el("button","icon-btn","✎"), del=el("button","icon-btn delete","×");
    edit.type=del.type="button"; edit.title=`Editar ${p.name}`; edit.setAttribute("aria-label",`Editar ${p.name}`); del.title=`Eliminar ${p.name}`; del.setAttribute("aria-label",`Eliminar ${p.name}`);
    edit.addEventListener("click",()=>startEdit(p.id)); del.addEventListener("click",()=>deleteProduct(p.id)); actions.append(edit,del); card.append(symbol,main,actions); return card;
  }
  function resetForm() { form.reset(); idInput.value=""; categoryInput.value="Alimentación"; unitInput.value="ud."; formTitle.textContent="Añadir producto"; saveButton.textContent="Guardar producto"; cancelEditButton.classList.add("hidden"); }
  function startEdit(id) { const p=products.find(x=>x.id===id); if(!p)return; idInput.value=p.id; categoryInput.value=p.category; nameInput.value=p.name; quantityInput.value=p.quantity; unitInput.value=p.unit; expiryInput.value=p.expiry||""; formTitle.textContent="Editar producto"; saveButton.textContent="Guardar cambios"; cancelEditButton.classList.remove("hidden"); message(formMessage,""); document.querySelector("#shared-panel .panel:nth-child(2)").scrollIntoView({behavior:"smooth",block:"start"}); nameInput.focus({preventScroll:true}); }

  async function loadProducts() {
    if (!pantry) return;
    message($("#connection-status"),"Sincronizando despensa…");
    const {data,error}=await supabase.from("products").select("id,category,name,quantity,unit,expiry,created_at,updated_at").eq("pantry_id",pantry.id).order("created_at",{ascending:true});
    if(error){message($("#connection-status"),`No se pudieron cargar los productos: ${error.message}`,true);return;}
    products=(data||[]).map(p=>({...p, expiry:p.expiry||"", updatedAt:p.updated_at, createdAt:p.created_at})); render(); message($("#connection-status"),"Conectado · los cambios se comparten automáticamente.");
    const local = getLocalProducts(); $("#migrate-local-button").classList.toggle("hidden",!local.length || localStorage.getItem("despensa.shared.migrated.v1")==="yes");
  }
  function subscribeRealtime() {
    if(realtimeChannel)supabase.removeChannel(realtimeChannel);
    realtimeChannel=supabase.channel(`pantry-${pantry.id}`).on("postgres_changes",{event:"*",schema:"public",table:"products",filter:`pantry_id=eq.${pantry.id}`},()=>loadProducts()).subscribe();
  }
  async function findPantry() {
    const {data,error}=await supabase.from("pantry_members").select("pantry_id,pantries(id,name,invite_code)").eq("user_id",user.id).limit(1).maybeSingle();
    if(error){message(authMessage,`Error al consultar la despensa: ${error.message}`,true);return false;}
    if(!data){pantry=null; setupPanel.classList.remove("hidden"); sharedPanel.classList.add("hidden"); pantryChoice.classList.remove("hidden"); return false;}
    pantry=data.pantries; showShared(); await loadProducts(); subscribeRealtime(); return true;
  }
  function showShared() {
    setupPanel.classList.add("hidden"); sharedPanel.classList.remove("hidden"); $("#current-email").textContent=user.email||"Cuenta conectada"; $("#pantry-title").textContent=pantry.name||"Despensa compartida";
    if(pantry.invite_code){$("#invite-display").classList.remove("hidden"); $("#invite-code-display").textContent=pantry.invite_code;} else $("#invite-display").classList.add("hidden");
  }
  async function afterAuth(sessionUser) {
    user=sessionUser; message(authMessage,"");
    if(!user){setupPanel.classList.remove("hidden");sharedPanel.classList.add("hidden");pantryChoice.classList.add("hidden");return;}
    setupPanel.classList.remove("hidden"); sharedPanel.classList.add("hidden"); $("#email").value=user.email||""; pantryChoice.classList.add("hidden");
    await findPantry();
  }
  async function authAction(action) {
    if(!readyConfig){message(authMessage,"Primero configura supabase-config.js con la URL y la clave pública de tu proyecto Supabase.",true);return;}
    const email=$("#email").value.trim(), password=$("#password").value;
    if(!email||!password){message(authMessage,"Introduce tu correo y contraseña.",true);return;}
    message(authMessage,"Procesando…");
    const result=action==="signup"?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});
    if(result.error){message(authMessage,result.error.message,true);return;}
    if(action==="signup"&&!result.data.session){message(authMessage,"Cuenta creada. Revisa tu correo para confirmar la dirección y después inicia sesión.");return;}
    if(result.data.user)await afterAuth(result.data.user);
  }
  async function createPantry() {
    const name=$("#pantry-name").value.trim()||"Despensa de casa"; message(authMessage,"Creando despensa…");
    const {data,error}=await supabase.rpc("create_pantry",{p_name:name});
    if(error){message(authMessage,`No se pudo crear la despensa: ${error.message}`,true);return;}
    const row=Array.isArray(data)?data[0]:data;
    if(!row){message(authMessage,"La despensa se creó, pero no se recibió su código. Comprueba la configuración.",true);return;}
    pantry={id:row.pantry_id||row.id,name:row.pantry_name||name,invite_code:row.invite_code}; showShared(); await loadProducts(); subscribeRealtime();
    message($("#connection-status"),`Despensa creada. Código de invitación: ${pantry.invite_code}. Compártelo solo con tu pareja.`);
  }
  async function joinPantry() {
    const code=$("#invite-code").value.trim().toUpperCase(); if(!code){message(authMessage,"Introduce el código de invitación.",true);return;}
    message(authMessage,"Uniéndote a la despensa…"); const {data,error}=await supabase.rpc("join_pantry",{p_code:code});
    if(error){message(authMessage,`No se pudo unir a la despensa: ${error.message}`,true);return;}
    await findPantry();
  }
  async function saveProduct(event) {
    event.preventDefault(); const name=nameInput.value.trim(), quantity=Number(String(quantityInput.value).replace(",","."));
    if(!name){message(formMessage,"Escribe el nombre del producto.",true);nameInput.focus();return;}
    if(!Number.isFinite(quantity)||quantity<=0){message(formMessage,"La cantidad debe ser un número mayor que cero.",true);quantityInput.focus();return;}
    if(expiryInput.value&&!/^\d{4}-\d{2}-\d{2}$/.test(expiryInput.value)){message(formMessage,"Introduce una fecha válida.",true);return;}
    const payload={pantry_id:pantry.id,category:categoryInput.value,name,quantity,unit:unitInput.value,expiry:expiryInput.value||null,updated_at:new Date().toISOString()};
    const wasEdit = Boolean(idInput.value);
    let result;
    if(idInput.value) result=await supabase.from("products").update(payload).eq("id",idInput.value).eq("pantry_id",pantry.id);
    else result=await supabase.from("products").insert({...payload,created_by:user.id});
    if(result.error){message(formMessage,`No se pudo guardar: ${result.error.message}`,true);return;}
    resetForm(); await loadProducts(); message(formMessage,wasEdit?"Producto actualizado.":"Producto guardado y compartido.");
  }
  async function deleteProduct(id) {
    const p=products.find(x=>x.id===id); if(!p||!confirm(`¿Quieres eliminar «${p.name}» de la despensa compartida?`))return;
    const {error}=await supabase.from("products").delete().eq("id",id).eq("pantry_id",pantry.id);
    if(error){message(listMessage,`No se pudo eliminar: ${error.message}`,true);return;}
    if(idInput.value===id)resetForm(); await loadProducts(); message(listMessage,`Se ha eliminado «${p.name}» de la despensa compartida.`);
  }
  function downloadBackup(items) { const backup={app:"Despensa",version:2,exportedAt:new Date().toISOString(),products:items}; const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download=`despensa-copia-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url); }
  function getLocalProducts() { try { const data=JSON.parse(localStorage.getItem("despensa.products.v1")||"[]"); return Array.isArray(data)?data.filter(validProduct):[]; } catch { return []; } }
  async function importProducts(items, mode="add") {
    const clean=items.filter(validProduct).map(p=>({pantry_id:pantry.id,created_by:user.id,category:p.category,name:p.name.trim(),quantity:Number(p.quantity),unit:p.unit,expiry:p.expiry||null,updated_at:new Date().toISOString()}));
    if(!clean.length){message(listMessage,"No se encontraron productos válidos en el archivo.",true);return false;}
    const {error}=await supabase.from("products").insert(clean);
    if(error){message(listMessage,`No se pudieron importar los productos: ${error.message}`,true);return false;}
    await loadProducts(); message(listMessage,`Se han importado ${clean.length} productos a la despensa compartida.`); return true;
  }

  $("#login-button").addEventListener("click",()=>authAction("login")); $("#signup-button").addEventListener("click",()=>authAction("signup"));
  $("#create-pantry-button").addEventListener("click",createPantry); $("#join-pantry-button").addEventListener("click",joinPantry);
  $("#logout-button").addEventListener("click",async()=>{if(realtimeChannel)await supabase.removeChannel(realtimeChannel);await supabase.auth.signOut();pantry=null;products=[];render();await afterAuth(null);});
  $("#copy-code-button").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(pantry.invite_code);message($("#connection-status"),"Código copiado.");}catch{message($("#connection-status"),`Copia este código: ${pantry.invite_code}`);}});
  form.addEventListener("submit",saveProduct); cancelEditButton.addEventListener("click",()=>{resetForm();message(formMessage,"Edición cancelada.");});
  searchInput.addEventListener("input",render);categoryFilter.addEventListener("change",render);expiryFilter.addEventListener("change",render);
  exportButton.addEventListener("click",()=>downloadBackup(products));
  $("#import-button").addEventListener("click",()=>importFile.click());
  importFile.addEventListener("change",async()=>{const file=importFile.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text()), incoming=Array.isArray(parsed)?parsed:parsed.products;if(!Array.isArray(incoming))throw new Error("El archivo no contiene una lista de productos.");if(confirm(`Se añadirán los productos válidos del archivo a la despensa compartida. ¿Continuar?`))await importProducts(incoming);}catch(e){message(listMessage,`No se pudo importar: ${e.message}`,true);}finally{importFile.value="";}});
  $("#migrate-local-button").addEventListener("click",async()=>{const local=getLocalProducts();if(!local.length)return;if(!confirm(`Se añadirán ${local.length} productos guardados en este navegador a la despensa compartida. Revisa antes si ya existen para evitar duplicados. ¿Continuar?`))return;const ok=await importProducts(local);if(ok){localStorage.setItem("despensa.shared.migrated.v1","yes");$("#migrate-local-button").classList.add("hidden");}});

  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost")) window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.warn));
  if(!readyConfig){message(authMessage,"Antes de usar la aplicación, configura supabase-config.js siguiendo el README.",true);$("#login-button").disabled=true;$("#signup-button").disabled=true;}
  else if(!window.supabase){message(authMessage,"No se pudo cargar la biblioteca de conexión. Comprueba tu conexión a internet.",true);}
  else {
    supabase=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    supabase.auth.getSession().then(({data})=>afterAuth(data.session?.user||null));
  }
  render();
})();
