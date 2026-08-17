document.addEventListener("DOMContentLoaded", function () {

  // ─── DADOS ───
  let chamados = JSON.parse(localStorage.getItem("chamados")) || [];
  let idParaExcluir = null;
  let paginaAtual = 1;
  const itensPorPagina = 10;

  const slaPorPrioridade = {
    baixa:   24 * 60,
    media:   8  * 60,
    alta:    4  * 60,
    critica: 1  * 60,
  };

  // ─── RELÓGIO ───
  function atualizarRelogio() {
    document.getElementById("hora").textContent =
      new Date().toLocaleTimeString("pt-BR");
  }

  // ─── GERAR PROTOCOLO ───
  function gerarProtocolo() {
    return "CHM-" + Date.now().toString().slice(-6);
  }

  // ─── SALVAR ───
  function salvarChamados() {
    localStorage.setItem("chamados", JSON.stringify(chamados));
  }

  // ─── SLA ───
  function calcularSLA(chamado) {
    if (chamado.status === "resolvido") {
      return { texto: "Resolvido", classe: "sla-ok" };
    }
    const agora     = Date.now();
    const limite    = slaPorPrioridade[chamado.prioridade] * 60 * 1000;
    const decorrido = agora - chamado.abertura;
    const restante  = limite - decorrido;

    if (restante <= 0) return { texto: "SLA Expirado", classe: "sla-critico" };

    const minutos = Math.floor(restante / 60000);
    const horas   = Math.floor(minutos / 60);
    const mins    = minutos % 60;
    const texto   = horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
    const classe  = (decorrido / limite) >= 0.8 ? "sla-alerta" : "sla-ok";
    return { texto, classe };
  }

  // ─── MÉTRICAS ───
  function atualizarMetricas() {
    const hoje = new Date().toDateString();
    document.getElementById("total-chamados").textContent = chamados.length;
    document.getElementById("total-atendimento").textContent =
      chamados.filter(c => c.status === "atendimento").length;
    document.getElementById("total-criticos").textContent =
      chamados.filter(c => c.prioridade === "critica" && c.status !== "resolvido").length;
    document.getElementById("total-resolvidos").textContent =
      chamados.filter(c =>
        c.status === "resolvido" &&
        new Date(c.resolvidoEm).toDateString() === hoje
      ).length;
  }

  // ─── ALERTA SLA ───
  function verificarSLA() {
    const criticos = chamados.filter(function (c) {
      if (c.status === "resolvido") return false;
      const limite    = slaPorPrioridade[c.prioridade] * 60 * 1000;
      const decorrido = Date.now() - c.abertura;
      return decorrido >= limite * 0.8;
    });

    const barra   = document.getElementById("barra-sla");
    const mensagem = document.getElementById("mensagem-sla");

    if (criticos.length > 0) {
      mensagem.textContent = criticos.map(c => c.protocolo).join(", ");
      barra.classList.remove("oculto");
    } else {
      barra.classList.add("oculto");
    }
  }
  
  // ─── DETALHES DO CHAMADO ───
  let chamadoAtual = null;

  function abrirDetalhes(id) {
    const c = chamados.find(c => c.id === id);
    if (!c) return;

    chamadoAtual = c;
    if (!c.comentarios) c.comentarios = [];

    const sla = calcularSLA(c);

    document.getElementById("detalhe-protocolo").textContent   = c.protocolo;
    document.getElementById("detalhe-solicitante").textContent = c.solicitante;
    document.getElementById("detalhe-setor").textContent       = c.setor;
    document.getElementById("detalhe-categoria").textContent   = c.categoria;
    document.getElementById("detalhe-prioridade").textContent  = c.prioridade.charAt(0).toUpperCase() + c.prioridade.slice(1);
    document.getElementById("detalhe-status").textContent      = c.status === "atendimento" ? "Em Atendimento" : c.status.charAt(0).toUpperCase() + c.status.slice(1);
    document.getElementById("detalhe-sla").textContent         = sla.texto;
    document.getElementById("detalhe-abertura").textContent    = new Date(c.abertura).toLocaleString("pt-BR");
    document.getElementById("detalhe-resolucao").textContent   = c.resolvidoEm ? new Date(c.resolvidoEm).toLocaleString("pt-BR") : "—";
    document.getElementById("detalhe-descricao").textContent   = c.descricao;

    renderizarComentarios(c);
    document.getElementById("modal-detalhes").classList.remove("oculto");
  }

  function renderizarComentarios(c) {
    const lista = document.getElementById("lista-comentarios");
    lista.innerHTML = "";

    if (c.comentarios.length === 0) {
      lista.innerHTML = '<li style="color:#9ca3af;font-size:13px;">Nenhum comentário ainda.</li>';
      return;
    }

    c.comentarios.forEach(function (com) {
      const item = document.createElement("li");
      item.classList.add("comentario-item");
      item.innerHTML = `
        <span class="comentario-texto">${com.texto}</span>
        <span class="comentario-hora">${com.hora}</span>
      `;
      lista.appendChild(item);
    });
  }

  document.getElementById("btn-comentar").addEventListener("click", function () {
    const texto = document.getElementById("novo-comentario").value.trim();
    if (!texto || !chamadoAtual) return;

    if (!chamadoAtual.comentarios) chamadoAtual.comentarios = [];

    chamadoAtual.comentarios.push({
      texto: texto,
      hora:  new Date().toLocaleString("pt-BR"),
    });

    salvarChamados();
    renderizarComentarios(chamadoAtual);
    document.getElementById("novo-comentario").value = "";
  });

  document.getElementById("fechar-detalhes").addEventListener("click", function () {
    document.getElementById("modal-detalhes").classList.add("oculto");
    chamadoAtual = null;
  });

  // ─── TABELA ───
  function renderizarTabela() {
    const busca    = document.getElementById("busca").value.toLowerCase();
    const filtroSt = document.getElementById("filtro-status").value;
    const filtroPr = document.getElementById("filtro-prioridade").value;

    const filtrados = chamados
      .filter(c => {
        const buscaOk      = busca === "" ||
          c.protocolo.toLowerCase().includes(busca) ||
          c.solicitante.toLowerCase().includes(busca);
        const statusOk     = filtroSt === "todos" || c.status === filtroSt;
        const prioridadeOk = filtroPr === "todos" || c.prioridade === filtroPr;
        return buscaOk && statusOk && prioridadeOk;
      })
      .slice()
      .reverse();

    const corpo = document.getElementById("tabela-chamados");
    const vazio = document.getElementById("lista-vazia");
    corpo.innerHTML = "";

    if (filtrados.length === 0) {
      vazio.style.display = "block";
      document.getElementById("paginacao").innerHTML = "";
      return;
    }

    vazio.style.display = "none";

    const totalPaginas = Math.ceil(filtrados.length / itensPorPagina);
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

    const inicio   = (paginaAtual - 1) * itensPorPagina;
    const fim      = inicio + itensPorPagina;
    const visiveis = filtrados.slice(inicio, fim);

    visiveis.forEach(function (c) {
      const sla   = calcularSLA(c);
      const data  = new Date(c.abertura).toLocaleString("pt-BR");
      const linha = document.createElement("tr");

      const btnAtender = c.status === "aberto"
        ? `<button type="button" class="btn-acao btn-atender" data-id="${c.id}">Atender</button>`
        : "";

      const btnResolver = c.status !== "resolvido"
        ? `<button type="button" class="btn-acao btn-resolver" data-id="${c.id}">Resolver</button>`
        : "";

      const btnVer =
        `<button type="button" class="btn-acao btn-ver" data-id="${c.id}">Ver</button>`;

      const btnExcluir =
        `<button type="button" class="btn-acao btn-excluir" data-id="${c.id}">Excluir</button>`;

      linha.innerHTML = `
        <td><strong>${c.protocolo}</strong></td>
        <td>${c.solicitante}</td>
        <td>${c.setor}</td>
        <td>${c.categoria}</td>
        <td><span class="badge-prioridade ${c.prioridade}">${c.prioridade.charAt(0).toUpperCase() + c.prioridade.slice(1)}</span></td>
        <td><span class="badge-status ${c.status}">${c.status === "atendimento" ? "Em Atendimento" : c.status.charAt(0).toUpperCase() + c.status.slice(1)}</span></td>
        <td>${data}</td>
        <td class="${sla.classe}">${sla.texto}</td>
        <td>${btnVer}${btnAtender}${btnResolver}${btnExcluir}</td>
      `;
      corpo.appendChild(linha);
    });

    // Paginação
    const paginacao = document.getElementById("paginacao");
    paginacao.innerHTML = "";

    if (totalPaginas > 1) {
      const btnAnterior = document.createElement("button");
      btnAnterior.type = "button";
      btnAnterior.classList.add("btn-pagina");
      btnAnterior.textContent = "← Anterior";
      btnAnterior.disabled = paginaAtual === 1;
      btnAnterior.addEventListener("click", function () {
        paginaAtual--;
        renderizarTabela();
      });
      paginacao.appendChild(btnAnterior);

      for (let i = 1; i <= totalPaginas; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.classList.add("btn-pagina");
        if (i === paginaAtual) btn.classList.add("ativo");
        btn.textContent = i;
        btn.addEventListener("click", function () {
          paginaAtual = i;
          renderizarTabela();
        });
        paginacao.appendChild(btn);
      }

      const btnProximo = document.createElement("button");
      btnProximo.type = "button";
      btnProximo.classList.add("btn-pagina");
      btnProximo.textContent = "Próximo →";
      btnProximo.disabled = paginaAtual === totalPaginas;
      btnProximo.addEventListener("click", function () {
        paginaAtual++;
        renderizarTabela();
      });
      paginacao.appendChild(btnProximo);
    }

    atualizarMetricas();
  }

  // ─── ABRIR CHAMADO ───
  document.getElementById("formChamado").addEventListener("submit", function (e) {
    e.preventDefault();

    const novoChamado = {
      id:          Date.now(),
      protocolo:   gerarProtocolo(),
      solicitante: document.getElementById("solicitante").value,
      setor:       document.getElementById("setor").value,
      categoria:   document.getElementById("categoria").value,
      prioridade:  document.getElementById("prioridade").value,
      descricao:   document.getElementById("descricao").value,
      status:      "aberto",
      abertura:    Date.now(),
      resolvidoEm: null,
    };

    chamados.push(novoChamado);
    salvarChamados();
    renderizarTabela();
    atualizarMetricas();
    this.reset();

    mostrarSecao("chamados");
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("ativo"));
    document.querySelector('[data-secao="chamados"]').classList.add("ativo");
  });

  // ─── AÇÕES NA TABELA ───
  document.addEventListener("click", function (e) {
    const id      = Number(e.target.getAttribute("data-id"));
    const chamado = chamados.find(c => c.id === id);

    if (e.target.classList.contains("btn-atender") && chamado) {
      chamado.status = "atendimento";
      salvarChamados();
      renderizarTabela();
    }

    if (e.target.classList.contains("btn-resolver") && chamado) {
      chamado.status      = "resolvido";
      chamado.resolvidoEm = Date.now();
      salvarChamados();
      renderizarTabela();
      atualizarMetricas();
    }

    if (e.target.classList.contains("btn-ver")) {
      abrirDetalhes(id);
    }

    if (e.target.classList.contains("btn-excluir") && chamado) {
      idParaExcluir = id;
      document.getElementById("modal-overlay").classList.remove("oculto");
    }
  });

  // ─── MODAL ───
  document.getElementById("modal-cancelar").addEventListener("click", function () {
    idParaExcluir = null;
    document.getElementById("modal-overlay").classList.add("oculto");
  });

  document.getElementById("modal-confirmar").addEventListener("click", function () {
    chamados = chamados.filter(c => c.id !== idParaExcluir);
    idParaExcluir = null;
    salvarChamados();
    renderizarTabela();
    atualizarMetricas();
    document.getElementById("modal-overlay").classList.add("oculto");
  });

  // ─── FILTROS E BUSCA ───
  document.getElementById("busca").addEventListener("input", function () {
    paginaAtual = 1;
    renderizarTabela();
  });
  document.getElementById("filtro-status").addEventListener("change", function () {
    paginaAtual = 1;
    renderizarTabela();
  });
  document.getElementById("filtro-prioridade").addEventListener("change", function () {
    paginaAtual = 1;
    renderizarTabela();
  });

  // ─── MENU LATERAL ───
  function mostrarSecao(secao) {
    document.getElementById("secao-dashboard").classList.add("oculto");
    document.getElementById("secao-novo-chamado").classList.add("oculto");
    document.getElementById("secao-chamados").classList.add("oculto");
    document.getElementById(`secao-${secao}`).classList.remove("oculto");
  }

  document.querySelectorAll(".nav-item").forEach(function (item) {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("ativo"));
      item.classList.add("ativo");
      mostrarSecao(item.getAttribute("data-secao"));
    });
  });

  // ─── EXPORTAR ───
  document.getElementById("btn-exportar").addEventListener("click", function () {
    document.getElementById("exportar-menu").classList.toggle("oculto");
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".exportar-wrapper")) {
      document.getElementById("exportar-menu").classList.add("oculto");
    }
  });

  document.getElementById("btn-pdf").addEventListener("click", function () {
    document.getElementById("exportar-menu").classList.add("oculto");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Relatório de Chamados — HelpDesk", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 28);

    const colunas = ["Protocolo", "Solicitante", "Setor", "Categoria", "Prioridade", "Status"];
    const linhas  = chamados.map(c => [
      c.protocolo,
      c.solicitante,
      c.setor,
      c.categoria,
      c.prioridade.charAt(0).toUpperCase() + c.prioridade.slice(1),
      c.status === "atendimento" ? "Em Atendimento" : c.status.charAt(0).toUpperCase() + c.status.slice(1),
    ]);

    doc.autoTable({
      head: [colunas],
      body: linhas,
      startY: 35,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [31, 58, 45] },
    });

    doc.save("chamados.pdf");
  });

  document.getElementById("btn-excel").addEventListener("click", function () {
    document.getElementById("exportar-menu").classList.add("oculto");

    const dados = chamados.map(c => ({
      Protocolo:   c.protocolo,
      Solicitante: c.solicitante,
      Setor:       c.setor,
      Categoria:   c.categoria,
      Prioridade:  c.prioridade.charAt(0).toUpperCase() + c.prioridade.slice(1),
      Status:      c.status === "atendimento" ? "Em Atendimento" : c.status.charAt(0).toUpperCase() + c.status.slice(1),
      "Aberto em": new Date(c.abertura).toLocaleString("pt-BR"),
      "Resolvido em": c.resolvidoEm ? new Date(c.resolvidoEm).toLocaleString("pt-BR") : "—",
    }));

    const planilha = XLSX.utils.json_to_sheet(dados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, planilha, "Chamados");
    XLSX.writeFile(workbook, "chamados.xlsx");
  });

  // ─── INICIALIZAÇÃO ───
  atualizarRelogio();
  atualizarMetricas();
  renderizarTabela();
  verificarSLA();
  mostrarSecao("dashboard");

  setInterval(atualizarRelogio, 1000);
  setInterval(renderizarTabela, 30000);
  setInterval(verificarSLA, 30000);

});