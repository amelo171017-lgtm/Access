(() => {
  'use strict';
  
  const CONFIG = {
    url: 'https://ohkkrqmxtgxbmetpfwda.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oa2tycW14dGd4Ym1ldHBmd2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MjYxODIsImV4cCI6MjA3MjUwMjE4Mn0.jKirhDC_MoijRGzh2EJ5zMrCB7tS5A7XdeD3ZCZAToE'
  };

  const validateEnvironment = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('Environment validation failed');
    }
    
    if (!CONFIG.url || !CONFIG.key) {
      throw new Error('Configuration validation failed');
    }
    
    return true;
  };

  const rateLimiter = {
    attempts: 0,
    lastAttempt: 0,
    maxAttempts: 5,
    cooldownTime: 60000,
    
    canAttempt() {
      const now = Date.now();
      if (now - this.lastAttempt > this.cooldownTime) {
        this.attempts = 0;
      }
      return this.attempts < this.maxAttempts;
    },
    
    recordAttempt() {
      this.attempts++;
      this.lastAttempt = Date.now();
    },
    
    getRemainingTime() {
      const elapsed = Date.now() - this.lastAttempt;
      return Math.max(0, this.cooldownTime - elapsed);
    }
  };

  const sanitizeInput = (input) => {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
  };

  const validateCode = (code) => {
    if (!code || typeof code !== 'string') return false;
    if (code.length !== 8) return false;
    if (!/^[a-zA-Z0-9]{8}$/.test(code)) return false;
    return true;
  };

  validateEnvironment();

  const getElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Element with id '${id}' not found`);
    }
    return element;
  };

  let form, input, errorMsg, initialScreen, secondScreen, dynamicContent, toggleCodeBtn, modal, pdfCanvas, pdfControls, prevPageBtn, nextPageBtn, pageInfo, zoomInBtn, zoomOutBtn, modalTitle;
  let pdfDoc = null;
  let currentPage = 1;
  let scale = 1.5;

  try {
    form = getElement("code-form");
    input = getElement("access-code");
    errorMsg = getElement("error-msg");
    initialScreen = getElement("initial-screen");
    secondScreen = getElement("second-screen");
    dynamicContent = getElement("dynamic-content");
    toggleCodeBtn = getElement("toggle-code");
    modal = getElement("modal");
    pdfCanvas = getElement("pdf-canvas");
    pdfControls = getElement("pdf-controls");
    prevPageBtn = getElement("prev-page");
    nextPageBtn = getElement("next-page");
    pageInfo = getElement("page-info");
    zoomInBtn = getElement("zoom-in");
    zoomOutBtn = getElement("zoom-out");
    modalTitle = getElement("modal-title");
  } catch (error) {
    return;
  }

  function showError(message) {
    try {
      if (typeof message !== 'string') message = 'Erro desconhecido';
      message = message.substring(0, 200);
      errorMsg.textContent = message;
      
    } catch (error) {
    }
  }

  function clearError() {
    try {
      errorMsg.textContent = "";
    } catch (error) {
    }
  }

  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const isValidUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:' &&
             (urlObj.hostname === 'drive.google.com' ||
              urlObj.hostname.endsWith('.googleapis.com') ||
              urlObj.hostname === 'ohkkrqmxtgxbmetpfwda.supabase.co');
    } catch {
      return false;
    }
  };

  function toggleCodeVisibility() {
    try {
      if (!input || !toggleCodeBtn) return;
      
      if (input.type === "password") {
        input.type = "text";
        toggleCodeBtn.textContent = "Ocultar código";
      } else {
        input.type = "password";
        toggleCodeBtn.textContent = "Ver código";
      }
    } catch (error) {
    }
  }

  function getDrivePreviewLink(link) {
    try {
      if (!link || typeof link !== 'string') return '';
      if (!isValidUrl(link)) return '';

      const url = new URL(link);
      if (url.hostname === 'drive.google.com' && url.pathname.startsWith('/file/d/')) {
        const pathParts = url.pathname.split('/');
        if (pathParts.length >= 4) {
          const fileId = pathParts[3];
          if (/^[a-zA-Z0-9_-]+$/.test(fileId)) {
            return `https://drive.google.com/uc?export=download&id=${fileId}`;
          }
        }
      } else if (url.hostname === 'ohkkrqmxtgxbmetpfwda.supabase.co') {

        return link;
      }
      return '';
    } catch (error) {
      return '';
    }
  }

  function renderPage(pageNum) {
    try {
      if (!pdfDoc || !pdfCanvas) return;


      pdfDoc.getPage(pageNum).then(function(page) {
        const viewport = page.getViewport({ scale: scale });
        const canvas = pdfCanvas;
        const context = canvas.getContext('2d');

        context.clearRect(0, 0, canvas.width, canvas.height);

        canvas.height = viewport.height;
        canvas.width = viewport.width;


        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        page.render(renderContext).promise.then(function() {
          if (pageInfo) {
            pageInfo.textContent = `Página ${pageNum} de ${pdfDoc.numPages}`;
          }
          if (prevPageBtn) prevPageBtn.disabled = pageNum <= 1;
          if (nextPageBtn) nextPageBtn.disabled = pageNum >= pdfDoc.numPages;
        }).catch(function(error) {
          showError('Erro ao exibir página do documento');
        });
      }).catch(function(error) {
        showError('Erro ao carregar página do documento');
      });
    } catch (error) {
    }
  }

  function loadPDF(url) {
    try {
      if (!pdfCanvas) return;

      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      if (pageInfo) pageInfo.textContent = 'Carregando documento...';

      const loadingTask = pdfjsLib.getDocument({
        url: url,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
      });

      loadingTask.promise.then(function(pdf) {
        pdfDoc = pdf;
        currentPage = 1;
        if (pdfControls) pdfControls.style.display = 'flex';
        if (prevPageBtn) prevPageBtn.style.display = pdf.numPages > 1 ? 'inline-block' : 'none';
        if (nextPageBtn) nextPageBtn.style.display = pdf.numPages > 1 ? 'inline-block' : 'none';

        const isMobile = window.innerWidth <= 480;
        if (isMobile && pdfControls) {
          pdfControls.style.flexDirection = 'column';
          pdfControls.style.alignItems = 'stretch';
        }

        renderPage(currentPage);
      }).catch(function(error) {
        showError('Erro ao carregar documento. Verifique o link e tente novamente.');
      });
    } catch (error) {
      showError('Erro ao carregar documento');
    }
  }

  function openModal(title, link) {
    try {
      if (!title || !link || !modal || !pdfCanvas || !modalTitle) return;

      const previewLink = getDrivePreviewLink(link);
      if (!previewLink) {
        showError('Link inválido ou não seguro');
        return;
      }

      const safeTitle = escapeHtml(title.substring(0, 100));

      modalTitle.textContent = safeTitle;
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";

      loadPDF(previewLink);
    } catch (error) {
      showError('Erro ao abrir documento');
    }
  }

  function closeModal() {
    try {
      if (!modal || !pdfCanvas) return;

      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");

      const context = pdfCanvas.getContext('2d');
      context.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);

      pdfDoc = null;
      currentPage = 1;
      scale = 1.5;

      document.body.style.overflow = "";
    } catch (error) {
    }
  }

  function renderContent(data) {
    dynamicContent.innerHTML = '';
    
    const screenWidth = window.innerWidth;
    if (screenWidth >= 992) {
      dynamicContent.style.display = 'grid';
      dynamicContent.style.gridTemplateColumns = 'repeat(3, 1fr)';
      dynamicContent.style.gap = '24px';
      dynamicContent.style.maxWidth = '1200px';
    } else if (screenWidth >= 768) {
      dynamicContent.style.display = 'grid';
      dynamicContent.style.gridTemplateColumns = 'repeat(2, 1fr)';
      dynamicContent.style.gap = '20px';
      dynamicContent.style.maxWidth = '800px';
    } else {
      dynamicContent.style.display = 'grid';
      dynamicContent.style.gridTemplateColumns = '1fr';
      dynamicContent.style.gap = '16px';
      dynamicContent.style.maxWidth = '100%';
    }

    if (!data || Object.keys(data).length === 0) {
      dynamicContent.innerHTML = '<p class="error">Nenhum material disponível.</p>';
      return;
    }

    Object.entries(data).forEach(([subjectKey, subjectData], index) => {
      const section = document.createElement('div');
      section.classList.add('subject-section');
      section.style.animationDelay = `${index * 0.1}s`;

      const h2 = document.createElement('h2');
      h2.textContent = subjectData.name.charAt(0).toUpperCase() + subjectData.name.slice(1);
      section.appendChild(h2);

      const actionsDiv = document.createElement('div');
      actionsDiv.classList.add('actions');

      if (subjectData.library && subjectData.library !== 'redacao') {
        const provaBtn = document.createElement('button');
        provaBtn.classList.add('action-btn');
        provaBtn.textContent = 'Ver prova';
        provaBtn.addEventListener('click', () => openModal(`Prova de ${subjectData.name.charAt(0).toUpperCase() + subjectData.name.slice(1)}`, subjectData.library));
        actionsDiv.appendChild(provaBtn);
      }

      if (subjectData.key) {
        const respostaBtn = document.createElement('button');
        respostaBtn.classList.add('action-btn', 'secondary');
        respostaBtn.textContent = 'Ver gabarito';
        respostaBtn.addEventListener('click', () => openModal(`Gabarito de ${subjectData.name.charAt(0).toUpperCase() + subjectData.name.slice(1)}`, subjectData.key));
        actionsDiv.appendChild(respostaBtn);
      }

      if (subjectData.library === 'redacao') {
        const redacaoBtn = document.createElement('button');
        redacaoBtn.classList.add('action-btn');
        redacaoBtn.textContent = 'Ver redação';
        redacaoBtn.addEventListener('click', () => openModal('Redação', subjectData.library));
        actionsDiv.appendChild(redacaoBtn);
      }

      if (actionsDiv.children.length > 0) {
        section.appendChild(actionsDiv);
        dynamicContent.appendChild(section);
      }
    });
  }

  async function sendCodeToSupabase(code) {
    clearError();

    if (!rateLimiter.canAttempt()) {
      const remainingTime = Math.ceil(rateLimiter.getRemainingTime() / 1000);
      showError(`Muitas tentativas. Tente novamente em ${remainingTime} segundos.`);
      return;
    }

    const sanitizedCode = sanitizeInput(code);
    if (!validateCode(sanitizedCode)) {
      rateLimiter.recordAttempt();
      showError("Código inválido. Use apenas letras e números (8 caracteres).");
      return;
    }

    rateLimiter.recordAttempt();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const headers = {
        'apikey': CONFIG.key,
        'Authorization': `Bearer ${CONFIG.key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      const queryUrl = `${CONFIG.url}/rest/v1/Library?code=eq.${encodeURIComponent(sanitizedCode)}&select=*`;
      
      const response = await fetch(queryUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          showError("Código não encontrado.");
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      
      if (!Array.isArray(data) || data.length === 0) {
        showError("Código não encontrado.");
        return;
      }

      const record = data[0];

      if (!record || typeof record !== 'object') {
        throw new Error('Dados inválidos recebidos');
      }

      if (typeof record.days !== 'number' || record.days < 0) {
        throw new Error('Dados de expiração inválidos');
      }

      if (!record.data || typeof record.data !== 'object') {
        throw new Error('Dados de conteúdo inválidos');
      }

      if (record.days <= 0) {
        showError("Código expirado.");
        return;
      }

      const newDays = Math.max(0, record.days - 1);
      const updateController = new AbortController();
      const updateTimeoutId = setTimeout(() => updateController.abort(), 5000);

      const updateResponse = await fetch(`${CONFIG.url}/rest/v1/Library?code=eq.${encodeURIComponent(sanitizedCode)}`, {
        method: 'PATCH',
        headers,
        signal: updateController.signal,
        credentials: 'omit',
        body: JSON.stringify({ days: newDays })
      });

      clearTimeout(updateTimeoutId);

      if (!updateResponse.ok) {
        console.warn('Failed to update usage count:', updateResponse.status);
      }

      if (validateSubjectData(record.data)) {
        renderContent(record.data);
        showSecondScreen();
      } else {
        throw new Error('Dados de matérias inválidos');
      }

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        showError("Tempo limite excedido. Verifique sua conexão.");
      } else if (error.message.includes('Failed to fetch')) {
        showError("Erro de conexão. Verifique sua internet.");
      } else {
        showError("Erro interno. Tente novamente mais tarde.");
      }
    }
  }

  function validateSubjectData(data) {
    try {
      if (!data || typeof data !== 'object') return false;
      
      for (const [key, subject] of Object.entries(data)) {
        if (!subject || typeof subject !== 'object') return false;
        if (!subject.name || typeof subject.name !== 'string') return false;
        if (subject.name.length > 50) return false;
        
        if (subject.library && subject.library !== 'redacao') {
          if (!isValidUrl(subject.library)) return false;
        }
        if (subject.key && !isValidUrl(subject.key)) return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  function showSecondScreen() {
    try {
      if (!initialScreen || !secondScreen) return;
      
      initialScreen.classList.add('fade-out');
      
      setTimeout(() => {
        initialScreen.style.display = "none";
        secondScreen.style.display = "flex";
        secondScreen.classList.add('fade-in');
      }, 300);
    } catch (error) {
    }
  }

  function adjustGrid() {
    try {
      if (!dynamicContent || !dynamicContent.children.length) return;
      
      const screenWidth = window.innerWidth;
      if (screenWidth >= 992) {
        dynamicContent.style.display = 'grid';
        dynamicContent.style.gridTemplateColumns = 'repeat(3, 1fr)';
        dynamicContent.style.gap = '24px';
        dynamicContent.style.maxWidth = '1200px';
      } else if (screenWidth >= 768) {
        dynamicContent.style.display = 'grid';
        dynamicContent.style.gridTemplateColumns = 'repeat(2, 1fr)';
        dynamicContent.style.gap = '20px';
        dynamicContent.style.maxWidth = '800px';
      } else {
        dynamicContent.style.display = 'grid';
        dynamicContent.style.gridTemplateColumns = '1fr';
        dynamicContent.style.gap = '16px';
        dynamicContent.style.maxWidth = '100%';
      }
    } catch (error) {
    }
  }

  try {
    if (form) {
      form.addEventListener("submit", async (e) => {
        try {
          e.preventDefault();
          const code = input?.value?.trim();
          if (code) {
            await sendCodeToSupabase(code);
          } else {
            showError("Por favor, digite um código.");
          }
        } catch (error) {
          showError("Erro ao enviar código. Tente novamente.");
        }
      });
    }

    if (toggleCodeBtn) {
      toggleCodeBtn.addEventListener("click", (e) => {
        try {
          e.preventDefault();
          toggleCodeVisibility();
        } catch (error) {
        }
      });
    }

    if (window) {
      window.addEventListener('resize', () => {
        try {
          adjustGrid();
        } catch (error) {
        }
      });
    }

    if (modal) {
      modal.addEventListener("click", (e) => {
        try {
          if (e.target?.matches?.("[data-close]") || e.target?.classList?.contains('modal-backdrop')) {
            closeModal();
          }
        } catch (error) {
        }
      });
    }

    if (document) {
      document.addEventListener("keydown", (e) => {
        try {
          if (e.key === "Escape" && modal?.classList?.contains("open")) {
            closeModal();
          }
        } catch (error) {
        }
      });
    }

    if (input) {
      input.addEventListener('input', (e) => {
        try {
          const value = e.target.value;
          if (value.length > 8) {
            e.target.value = value.substring(0, 8);
          }
        } catch (error) {
        }
      });
    }

    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', () => {
        try {
          if (currentPage > 1) {
            currentPage--;
            renderPage(currentPage);
          }
        } catch (error) {
          console.error('Erro na página anterior:', error);
        }
      });
    }

    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', () => {
        try {
          if (pdfDoc && currentPage < pdfDoc.numPages) {
            currentPage++;
            renderPage(currentPage);
          }
        } catch (error) {
          console.error('Erro na próxima página:', error);
        }
      });
    }

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        try {
          scale = Math.min(scale + 0.25, 3);
          renderPage(currentPage);
        } catch (error) {
          console.error('Erro no zoom +:', error);
        }
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        try {
          scale = Math.max(scale - 0.25, 0.5);
          renderPage(currentPage);
        } catch (error) {
          console.error('Erro no zoom -:', error);
        }
      });
    }

  } catch (error) {
  }

  Object.freeze(CONFIG);
})();