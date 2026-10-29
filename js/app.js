// ============================================================================
// HOA SEN HOME | TUSLO & LUSHINE 2026 E-CATALOGUE APPLICATION LOGIC
// ============================================================================

(function () {
  const DATA = window.CATALOGUE_DATA || {
    metadata: {},
    categories: [],
    products: [],
    smart_toilet_matrix: [],
    combos: [],
    pages: []
  };

  // Vietnamese accent removal for smart search
  function normalizeVN(str) {
    if (!str) return "";
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s*._-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatVND(num) {
    if (!num && num !== 0) return "Liên hệ";
    return Number(num).toLocaleString("vi-VN") + " VNĐ";
  }

  // Pre-index products for fast search
  DATA.products.forEach((p) => {
    const comboNames = (p.combos_su_dung || []).map((c) => c.ma_combo).join(" ");
    const rawSearch = [
      p.ma_san_pham,
      p.ma_goc,
      p.ten_san_pham,
      p.danh_muc,
      ...(p.danh_muc_phu || []),
      p.loai_phu,
      p.thuong_hieu,
      p.bo_suu_tap,
      p.kich_thuoc,
      p.chat_lieu,
      p.be_mat,
      p.che_do_nuoc || "",
      ...(p.thong_so_ky_thuat || []),
      ...(p.badges || []),
      comboNames,
      `trang ${p.trang_pdf}`,
      `cat ${p.trang_catalogue}`
    ].join(" ");
    p._searchIndex = normalizeVN(rawSearch);
  });

  // Application State
  const state = {
    searchQuery: "",
    category: "ALL",
    brand: "ALL",
    collection: "ALL",
    minPrice: 0,
    maxPrice: 65000000,
    pricePreset: "all",
    onlyBestseller: false,
    only2026: false,
    onlyDrawing: false,
    onlyAR: false,
    onlyInCombo: false,
    waterMode: "ALL",
    pdfPage: "ALL",
    sortBy: "catalogue",
    viewMode: "grid",
    quickFilter: "all",
    comboTier: "ALL",
    lookbookFilter: "ALL",
    compareIds: [],
    quoteItems: {}, // { [productId]: quantity }
    quoteMeta: {
      customerName: "",
      customerPhone: "",
      projectName: "",
      discountPct: 0,
      notes: ""
    },
    explorerPage: 12,
    explorerZoom: 100,
    highlightedProductId: null
  };

  function loadQuoteFromStorage() {
    try {
      const raw = localStorage.getItem("tuslo_lushine_2026_quote_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          state.quoteItems = parsed.items || {};
          state.quoteMeta = Object.assign(state.quoteMeta, parsed.meta || {});
        }
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  function saveQuoteToStorage() {
    try {
      localStorage.setItem(
        "tuslo_lushine_2026_quote_v1",
        JSON.stringify({ items: state.quoteItems, meta: state.quoteMeta })
      );
    } catch (e) {
      // Ignore storage errors
    }
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  function init() {
    loadQuoteFromStorage();
    renderHeaderCategories();
    renderCategoryOverviewCards();
    renderSidebarFilters();
    renderFilteredProducts();
    renderCombosSection();
    renderTechShowcase();
    renderLookbookSection();
    initCatalogueExplorer();
    updateQuoteBadge();
    bindGlobalEvents();
  }

  function bindGlobalEvents() {
    const searchInput = document.getElementById("globalSearchInput");
    const clearBtn = document.getElementById("searchClearBtn");

    if (searchInput) {
      searchInput.addEventListener("focus", () => {
        renderSearchSuggestions(searchInput.value);
      });

      searchInput.addEventListener("input", (e) => {
        state.searchQuery = e.target.value;
        clearBtn.style.display = state.searchQuery ? "flex" : "none";
        renderSearchSuggestions(state.searchQuery);
        renderFilteredProducts();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        state.searchQuery = "";
        clearBtn.style.display = "none";
        closeSearchSuggestions();
        renderFilteredProducts();
      });
    }

    // Click outside search wrap to close suggestions dropdown
    document.addEventListener("click", (e) => {
      const wrap = document.getElementById("headerSearchWrap");
      if (wrap && !wrap.contains(e.target)) {
        closeSearchSuggestions();
      }
    });

    const slider = document.getElementById("maxPriceSlider");
    if (slider) {
      slider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10);
        state.maxPrice = val;
        state.minPrice = 0;
        state.pricePreset = "custom";
        document.getElementById("priceSliderLabel").textContent =
          "Tối đa: " + val.toLocaleString("vi-VN") + " ₫";
        document.querySelectorAll(".price-preset-btn").forEach((b) => b.classList.remove("active"));
        renderFilteredProducts();
      });
    }

    // Keyboard shortcuts: Ctrl+K to focus search, Esc to close modals
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (searchInput) {
          searchInput.focus();
          renderSearchSuggestions(searchInput.value);
        }
      } else if (e.key === "Escape") {
        closeSearchSuggestions();
        closeMobileFilter();
        closeLightbox();
        closeProductModal();
        closeComboModal();
        closeCompareModal();
        closeStatsModal();
        closeConfiguratorModal();
        closeARModal();
        closeQuoteModal();
      }
    });

    // Scroll listener: Back-to-top button & Header section indicator
    const backToTopBtn = document.getElementById("backToTopBtn");
    const trackSections = [
      { id: "showroomSection" },
      { id: "combosSection" },
      { id: "techShowcaseSection" },
      { id: "lookbookSection" },
      { id: "catalogueExplorerSection" }
    ];

    window.addEventListener(
      "scroll",
      () => {
        const scrollY = window.scrollY || window.pageYOffset;
        if (backToTopBtn) {
          if (scrollY > 320) {
            backToTopBtn.classList.add("visible");
          } else {
            backToTopBtn.classList.remove("visible");
          }
        }

        let currentSec = "";
        for (const sec of trackSections) {
          const el = document.getElementById(sec.id);
          if (el) {
            const top = el.getBoundingClientRect().top;
            if (top <= 180) {
              currentSec = sec.id;
            }
          }
        }
        if (currentSec) {
          document.querySelectorAll(".header-actions .nav-btn").forEach((btn) => {
            const onclickAttr = btn.getAttribute("onclick") || "";
            if (onclickAttr.includes(currentSec)) {
              btn.classList.add("active");
            } else if (onclickAttr.includes("scrollToSection")) {
              btn.classList.remove("active");
            }
          });
        }
      },
      { passive: true }
    );
  }

  // ==========================================================================
  // RENDER HEADER & OVERVIEW CATEGORIES
  // ==========================================================================
  function renderHeaderCategories() {
    const strip = document.getElementById("headerCategoryStrip");
    if (!strip) return;

    let html = `
      <button class="cat-pill ${state.category === "ALL" ? "active" : ""}" onclick="app.selectCategory('ALL')">
        <span>Tất cả</span>
        <span class="count">${DATA.products.length}</span>
      </button>
    `;

    DATA.categories.forEach((cat) => {
      const isActive = state.category === cat.ten;
      html += `
        <button class="cat-pill ${isActive ? "active" : ""}" onclick="app.selectCategory('${cat.ten}')">
          <span>${cat.icon} ${cat.ten}</span>
          <span class="count">${cat.so_luong}</span>
        </button>
      `;
    });

    strip.innerHTML = html;
  }

  function renderCategoryOverviewCards() {
    const grid = document.getElementById("categoryCardsGrid");
    if (!grid) return;

    grid.innerHTML = DATA.categories
      .map((cat) => {
        const isActive = state.category === cat.ten;
        const brandCls = cat.thuong_hieu.toLowerCase();
        const minStr = (cat.gia_thap_nhat / 1000).toLocaleString("vi-VN") + "K";
        const maxStr =
          cat.gia_cao_nhat >= 1000000
            ? (cat.gia_cao_nhat / 1000000).toFixed(1).replace(".0", "") + "Tr"
            : (cat.gia_cao_nhat / 1000).toLocaleString("vi-VN") + "K";

        return `
        <div class="cat-overview-card ${isActive ? "active" : ""}" onclick="app.selectCategory('${cat.ten}')">
          <div class="cat-card-thumb">
            <img src="${cat.anh_dai_dien}" alt="${cat.ten}" loading="lazy" />
          </div>
          <div class="cat-card-info">
            <span class="cat-card-brand ${brandCls}">${cat.thuong_hieu}</span>
            <div class="cat-card-title" title="${cat.ten}">${cat.ten}</div>
            <div class="cat-card-meta"><strong>${cat.so_luong}</strong> mẫu • ${minStr} – ${maxStr}</div>
          </div>
        </div>
      `;
      })
      .join("");

    // Update brand buttons
    ["ALL", "TUSLO", "LUSHINE"].forEach((b) => {
      const btn = document.getElementById("brandBtn" + b);
      if (btn) {
        btn.classList.toggle("active", state.brand === b);
      }
    });
  }

  function renderSidebarFilters() {
    // 1. Brands
    const brandContainer = document.getElementById("filterBrandList");
    if (brandContainer) {
      const brands = [
        { val: "ALL", label: "Tất cả thương hiệu", count: DATA.products.length },
        {
          val: "TUSLO",
          label: "🛁 TUSLO (Thiết bị phòng tắm)",
          count: DATA.products.filter((p) => p.thuong_hieu === "TUSLO").length
        },
        {
          val: "LUSHINE",
          label: "🍽️ LUSHINE (Thiết bị nhà bếp)",
          count: DATA.products.filter((p) => p.thuong_hieu === "LUSHINE").length
        }
      ];
      brandContainer.innerHTML = brands
        .map(
          (b) => `
        <div class="filter-Export-check" onclick="app.filterByBrand('${b.val}')">
          <label>
            <input type="radio" name="brandRadio" ${state.brand === b.val ? "checked" : ""} />
            <span>${b.label}</span>
          </label>
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">${b.count}</span>
        </div>
      `
        )
        .join("");
    }

    // 2. Collections
    const colContainer = document.getElementById("filterCollectionList");
    if (colContainer) {
      const cols = [
        { val: "ALL", label: "Tất cả bộ sưu tập", count: DATA.products.length },
        {
          val: "2026 Collection",
          label: "🏆 2026 Collection",
          count: DATA.products.filter((p) => p.bo_suu_tap === "2026 Collection").length
        },
        {
          val: "Luxury",
          label: "💎 Dòng Luxury",
          count: DATA.products.filter((p) => p.bo_suu_tap === "Luxury" || p.ma_san_pham.includes("Luxury")).length
        },
        {
          val: "Pro",
          label: "⚡ Dòng Pro",
          count: DATA.products.filter((p) => p.bo_suu_tap === "Pro").length
        },
        {
          val: "Standard",
          label: "✨ Dòng Tiêu chuẩn (Standard)",
          count: DATA.products.filter((p) => p.bo_suu_tap === "Standard").length
        }
      ];
      colContainer.innerHTML = cols
        .map(
          (c) => `
        <div class="filter-Export-check" onclick="app.filterByCollection('${c.val}')">
          <label>
            <input type="radio" name="colRadio" ${state.collection === c.val ? "checked" : ""} />
            <span>${c.label}</span>
          </label>
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">${c.count}</span>
        </div>
      `
        )
        .join("");
    }

    // 3. PDF Page Select
    const pageSelect = document.getElementById("filterPageSelect");
    if (pageSelect && pageSelect.options.length <= 1) {
      const productPages = DATA.pages.filter((pg) => pg.so_san_pham > 0);
      productPages.forEach((pg) => {
        const opt = document.createElement("option");
        opt.value = String(pg.trang_pdf);
        opt.textContent = `Trang PDF ${pg.trang_pdf} (Cat ${pg.trang_catalogue}) — ${pg.chuyen_muc} (${pg.so_san_pham} SP)`;
        pageSelect.appendChild(opt);
      });
    }
  }

  // ==========================================================================
  // FILTERING & SORTING PRODUCTS
  // ==========================================================================
  function getFilteredProducts() {
    const q = normalizeVN(state.searchQuery);
    const qTokens = q ? q.split(" ").filter(Boolean) : [];

    let list = DATA.products.filter((p) => {
      // Search query
      if (qTokens.length > 0) {
        const matchAll = qTokens.every((tok) => p._searchIndex.includes(tok));
        if (!matchAll) return false;
      }

      // Category filter (supports primary danh_muc OR secondary danh_muc_phu when browsing)
      if (state.category !== "ALL") {
        if (p.danh_muc !== state.category && !(p.danh_muc_phu || []).includes(state.category)) {
          return false;
        }
      }

      // Brand filter
      if (state.brand !== "ALL" && p.thuong_hieu !== state.brand) {
        return false;
      }

      // Collection filter
      if (state.collection !== "ALL") {
        if (state.collection === "Luxury") {
          if (p.bo_suu_tap !== "Luxury" && !p.ma_san_pham.includes("Luxury")) return false;
        } else if (p.bo_suu_tap !== state.collection) {
          return false;
        }
      }

      // Price filter
      if (p.gia_so < state.minPrice || p.gia_so > state.maxPrice) {
        return false;
      }

      // Checkboxes
      if (state.onlyBestseller && !(p.badges || []).includes("BÁN CHẠY")) return false;
      if (state.only2026 && !(p.badges || []).includes("2026 COLLECTION")) return false;
      if (state.onlyDrawing && !p.ban_ve_ky_thuat) return false;
      if (state.onlyAR && !(p.badges || []).includes("Trải nghiệm AR")) return false;
      if (state.onlyInCombo && (!p.combos_su_dung || p.combos_su_dung.length === 0)) return false;

      // Water mode
      if (state.waterMode !== "ALL" && p.che_do_nuoc !== state.waterMode) {
        return false;
      }

      // PDF Page
      if (state.pdfPage !== "ALL" && String(p.trang_pdf) !== String(state.pdfPage)) {
        return false;
      }

      return true;
    });

    // Sorting
    const tierRank = { "2026 Collection": 4, Luxury: 3, Pro: 2, Standard: 1 };
    list.sort((a, b) => {
      if (state.sortBy === "price-asc") return a.gia_so - b.gia_so;
      if (state.sortBy === "price-desc") return b.gia_so - a.gia_so;
      if (state.sortBy === "code-asc") return a.ma_san_pham.localeCompare(b.ma_san_pham, "vi");
      if (state.sortBy === "tier-desc") {
        const diff = (tierRank[b.bo_suu_tap] || 0) - (tierRank[a.bo_suu_tap] || 0);
        return diff !== 0 ? diff : b.gia_so - a.gia_so;
      }
      return a.stt - b.stt;
    });

    return list;
  }

  function renderFilteredProducts() {
    const filtered = getFilteredProducts();
    const container = document.getElementById("productsContainer");
    const countEl = document.getElementById("visibleProductCount");
    const totalEl = document.getElementById("totalProductCount");
    const applyCountEl = document.getElementById("filterApplyCount");

    if (countEl) countEl.textContent = filtered.length;
    if (totalEl) totalEl.textContent = DATA.products.length;
    if (applyCountEl) applyCountEl.textContent = filtered.length;

    renderActiveChips();

    if (!container) return;
    container.className = state.viewMode === "list" ? "products-list" : "products-grid";

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; background:#fff; border:1px dashed var(--border-gold); border-radius:16px; padding:48px 24px; text-align:center;">
          <div style="font-size:2.4rem; margin-bottom:10px;">🔍</div>
          <h3 style="font-size:1.15rem; margin-bottom:6px;">Không tìm thấy sản phẩm phù hợp với bộ lọc hiện tại</h3>
          <p style="color:var(--text-muted); font-size:0.88rem; margin-bottom:16px;">Hãy thử xóa từ khóa tìm kiếm hoặc đặt lại bộ lọc để xem toàn bộ 203 sản phẩm.</p>
          <button class="nav-btn primary" onclick="app.resetAllFilters()">Đặt lại bộ lọc</button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((p) => renderProductCardHTML(p)).join("");
  }

  function renderProductCardHTML(p) {
    const badges = [];
    if ((p.badges || []).includes("BÁN CHẠY")) {
      badges.push(`<span class="p-badge bestseller">🔥 BÁN CHẠY</span>`);
    }
    if ((p.badges || []).includes("2026 COLLECTION")) {
      badges.push(`<span class="p-badge col2026">🏆 2026 COLLECTION</span>`);
    } else if (p.bo_suu_tap === "Luxury") {
      badges.push(`<span class="p-badge luxury">LUXURY</span>`);
    } else if (p.bo_suu_tap === "Pro") {
      badges.push(`<span class="p-badge pro">PRO</span>`);
    }
    if ((p.badges || []).includes("Trải nghiệm AR")) {
      badges.push(`<span class="p-badge ar" onclick="event.stopPropagation(); app.openARModal('${p.id}')" title="Nhấn để xem mô phỏng AR 3D & quét mã QR">📱 AR 3D</span>`);
    }

    let waterBadge = "";
    if (p.che_do_nuoc === "Nóng lạnh") {
      waterBadge = `<span class="water-tag hot-cold">Nóng lạnh</span>`;
    } else if (p.che_do_nuoc === "Lạnh") {
      waterBadge = `<span class="water-tag cold">Lạnh</span>`;
    }

    const drawingBtn = p.ban_ve_ky_thuat
      ? `<button class="drawing-toggle-pill" onclick="event.stopPropagation(); app.toggleCardDrawing(this, '${p.hinh_anh}', '${p.ban_ve_ky_thuat}')">📐 Bản vẽ KT</button>`
      : "";

    const specsPreview = (p.thong_so_ky_thuat || [])
      .slice(0, 3)
      .map((line) => `<div>• ${line}</div>`)
      .join("");

    const isCompared = state.compareIds.includes(p.id);
    const quoteQty = state.quoteItems[p.id] || 0;

    return `
      <article class="product-card" data-id="${p.id}">
        <div class="card-media" onclick="app.openProductModal('${p.id}')">
          <div class="card-badges">${badges.join("")}</div>
          <div class="card-top-right">
            <span class="page-tag" title="Trang PDF ${p.trang_pdf} | Trang Catalogue ${p.trang_catalogue}">PDF T.${p.trang_pdf} (Cat ${p.trang_catalogue})</span>
            ${waterBadge}
          </div>
          <img src="${p.hinh_anh}" alt="${p.ma_san_pham} - ${p.ten_san_pham}" loading="lazy" />
          ${drawingBtn}
        </div>

        <div class="card-body">
          <div class="card-main-info">
            <div class="card-cat-row">
              <span>${p.danh_muc}</span>
              <span class="card-brand-badge ${p.thuong_hieu}">${p.thuong_hieu}</span>
            </div>
            <div class="card-code" onclick="app.openProductModal('${p.id}')" style="cursor:pointer;">${p.ma_san_pham}</div>
            <div class="card-title">${p.ten_san_pham}</div>
          </div>

          <div class="card-specs-mini">
            ${specsPreview}
          </div>

          <div class="card-footer">
            <div class="card-price">${p.gia_niem_yet}</div>
            <div class="card-actions">
              <button class="icon-btn ${quoteQty > 0 ? "quote-active" : ""}" onclick="app.addToQuote('${p.id}', 1)" title="Thêm sản phẩm vào Bảng Báo Giá & Dự Toán">
                <span class="quote-btn-desktop">${quoteQty > 0 ? `🧾 Đã chọn (${quoteQty})` : "+ Báo giá"}</span>
                <span class="quote-btn-mobile">${quoteQty > 0 ? `🧾 ${quoteQty}` : "+ Báo giá"}</span>
              </button>
              <button class="icon-btn ${isCompared ? "compare-active" : ""}" onclick="app.toggleCompare('${p.id}')" title="Thêm vào so sánh">
                ${isCompared ? "✓" : "⚖️"}
              </button>
              <button class="icon-btn primary" onclick="app.openProductModal('${p.id}')">
                Chi tiết
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function renderActiveChips() {
    const chipBox = document.getElementById("activeFilterChips");
    if (!chipBox) return;

    const chips = [];
    if (state.searchQuery) {
      chips.push({ label: `Tìm: "${state.searchQuery}"`, action: `app.clearSearch()` });
    }
    if (state.category !== "ALL") {
      chips.push({ label: `Danh mục: ${state.category}`, action: `app.selectCategory('ALL')` });
    }
    if (state.brand !== "ALL") {
      chips.push({ label: `Thương hiệu: ${state.brand}`, action: `app.filterByBrand('ALL')` });
    }
    if (state.collection !== "ALL") {
      chips.push({ label: `Bộ sưu tập: ${state.collection}`, action: `app.filterByCollection('ALL')` });
    }
    if (state.pricePreset !== "all") {
      chips.push({
        label: `Giá: ${state.minPrice.toLocaleString("vi-VN")} – ${state.maxPrice.toLocaleString("vi-VN")} ₫`,
        action: `app.setPricePreset('all')`
      });
    }
    if (state.onlyBestseller) chips.push({ label: "🔥 Bán chạy", action: `app.clearCheckbox('chkBestseller')` });
    if (state.only2026) chips.push({ label: "🏆 2026 Collection", action: `app.clearCheckbox('chk2026')` });
    if (state.onlyDrawing) chips.push({ label: "📐 Có bản vẽ KT", action: `app.clearCheckbox('chkHasDrawing')` });
    if (state.onlyAR) chips.push({ label: "📱 Trải nghiệm AR", action: `app.clearCheckbox('chkHasAR')` });
    if (state.onlyInCombo) chips.push({ label: "🛋️ Trong 11 Combo", action: `app.clearCheckbox('chkInCombo')` });
    if (state.waterMode !== "ALL") {
      chips.push({ label: `Chế độ nước: ${state.waterMode}`, action: `app.clearWaterMode()` });
    }
    if (state.pdfPage !== "ALL") {
      chips.push({ label: `Trang PDF: ${state.pdfPage}`, action: `app.clearPdfPage()` });
    }

    chipBox.innerHTML = chips
      .map(
        (c) => `
      <span class="filter-chip">
        <span>${c.label}</span>
        <button onclick="${c.action}" title="Gỡ bộ lọc">✕</button>
      </span>
    `
      )
      .join("");

    const mobileBadge = document.getElementById("mobileFilterCount");
    if (mobileBadge) mobileBadge.textContent = chips.length;
    const mobileBtn = document.getElementById("mobileFilterToggleBtn");
    if (mobileBtn) mobileBtn.classList.toggle("has-filters", chips.length > 0);
  }

  // ==========================================================================
  // 11 BATHROOM COMBOS SECTION
  // ==========================================================================
  function renderCombosSection() {
    const container = document.getElementById("combosGridContainer");
    if (!container) return;

    const list =
      state.comboTier === "ALL"
        ? DATA.combos
        : DATA.combos.filter((c) => c.phan_khuc === state.comboTier);

    container.innerHTML = list
      .map((cb) => {
        const allItems = cb.san_pham || [];
        const coreItems = allItems.slice(0, 4);
        const accessoryItems = allItems.slice(4);

        const renderChip = (it) => {
          const prodObj = DATA.products.find((p) => p.ma_san_pham === it.ma_san_pham);
          const pid = prodObj ? prodObj.id : "";
          return `
            <div class="combo-item-chip" onclick="${pid ? `app.openProductModal('${pid}')` : ""}" title="Nhấn xem chi tiết ${it.ma_san_pham} • ${it.vai_tro} (${it.gia_niem_yet})">
              <img src="${it.hinh_anh}" alt="${it.ma_san_pham}" loading="lazy" />
              <div class="chip-text">
                <div class="chip-code">${it.ma_san_pham}</div>
                <div class="chip-desc">${it.vai_tro} • ${it.gia_niem_yet}</div>
              </div>
            </div>
          `;
        };

        const coreHTML = coreItems.map(renderChip).join("");

        let accessoriesHTML = "";
        if (accessoryItems.length > 0) {
          const accChips = accessoryItems.map(renderChip).join("");
          accessoriesHTML = `
            <div class="combo-more-toggle" onclick="app.toggleComboMore('${cb.ma_combo}', this)" id="comboToggle_${cb.ma_combo}">
              <span>✨ + ${accessoryItems.length} phụ kiện đồng bộ khác (Gương, xịt, kệ, xi phông...)</span>
              <span class="toggle-arrow">▾ Xem tất cả</span>
            </div>
            <div class="combo-more-container" id="comboMore_${cb.ma_combo}" style="display:none;">
              ${accChips}
            </div>
          `;
        }

        return `
        <article class="combo-card">
          <div class="combo-media" onclick="app.openComboModal('${cb.ma_combo}')">
            <span class="combo-tier-badge">${cb.phan_khuc} SERIES • TRANG PDF ${cb.trang_pdf} (CAT ${cb.trang_catalogue})</span>
            <img src="${cb.hinh_anh}" alt="${cb.ten_combo}" loading="lazy" />
          </div>
          <div class="combo-body">
            <div class="combo-title-row">
              <h3>Combo ${cb.ma_combo} (${cb.so_luong_san_pham} món)</h3>
              <span class="combo-total-price" title="Tổng giá niêm yết các sản phẩm thành phần">${cb.tong_gia_tri_fmt}</span>
            </div>
            <p class="combo-desc">${cb.mo_ta}</p>
            
            <div class="combo-core-label">
              <span>THIẾT BỊ CHÍNH TRONG COMBO (${coreItems.length}/${cb.so_luong_san_pham} MÓN):</span>
            </div>

            <div class="combo-items-chips">
              ${coreHTML}
            </div>

            ${accessoriesHTML}

            <div class="combo-card-footer">
              <button class="combo-btn-quote" onclick="app.addComboToQuote('${cb.ma_combo}')" title="Thêm toàn bộ ${cb.so_luong_san_pham} thiết bị vào Bảng Báo Giá">
                🧾 + Báo giá Combo
              </button>
              <button class="combo-btn-detail" onclick="app.openComboModal('${cb.ma_combo}')" title="Xem bảng thông số & phối cảnh chi tiết">
                🔍 Chi tiết
              </button>
              <button class="combo-btn-page" onclick="app.openPageInExplorer(${cb.trang_pdf})" title="Xem trang Catalogue gốc">
                📖 T.${cb.trang_pdf}
              </button>
            </div>
          </div>
        </article>
      `;
      })
      .join("");
  }

  function toggleComboMore(maCombo, btnEl) {
    const container = document.getElementById(`comboMore_${maCombo}`);
    if (!container) return;
    const isHidden = container.style.display === "none";
    if (isHidden) {
      container.style.display = "grid";
      if (btnEl) {
        btnEl.classList.add("expanded");
        const arrow = btnEl.querySelector(".toggle-arrow");
        if (arrow) arrow.textContent = "▴ Thu gọn";
      }
    } else {
      container.style.display = "none";
      if (btnEl) {
        btnEl.classList.remove("expanded");
        const arrow = btnEl.querySelector(".toggle-arrow");
        if (arrow) arrow.textContent = "▾ Xem tất cả";
      }
    }
  }

  // ==========================================================================
  // CORE TECHNOLOGY & MATERIAL SHOWCASE SECTION
  // ==========================================================================
  function renderTechShowcase() {
    const grid = document.getElementById("techShowcaseGrid");
    if (!grid) return;

    const techItems = [
      {
        title: "Men Sứ Nano Ceramic 1280°C & Xả Xoáy 360°",
        brand: "TUSLO",
        page: 14,
        catPage: "23–24",
        img: "assets/banners/tech_xa_xoay.jpg",
        category: "Bồn cầu 1 khối",
        desc: "Sứ vệ sinh TUSLO được nung ở nhiệt độ 1280°C giúp kết cấu sứ đặc chắc, kết hợp lớp men Nano Ceramic siêu mịn kháng khuẩn, chống bám bẩn và ố vàng.",
        highlights: [
          "Thiết kế Rimless không vành — không góc khuất vi khuẩn",
          "Hệ thống xả xoáy Super Vortex 360° & S-Trap cuốn trôi mạnh mẽ",
          "Nắp bồn cầu nhựa UF/PP đóng êm (Soft-close) chống trầy xước"
        ]
      },
      {
        title: "Công Nghệ Bồn Cầu Thông Minh 27 Tính Năng",
        brand: "TUSLO",
        page: 15,
        catPage: "25–26",
        img: "assets/banners/smart_toilet_intro.jpg",
        category: "Bồn cầu thông minh",
        desc: "Đỉnh cao tiện nghi phòng tắm hiện đại với cảm biến Radar tự động đóng/mở nắp, tạo bọt kháng khuẩn chống bắn nước và khử trùng bằng tia cực tím UV.",
        highlights: [
          "Cảm biến Radar nhận diện người dùng & đá chân mở nắp rảnh tay",
          "Tự động tạo lớp bọt kháng khuẩn ngăn mùi, chống văng bắn",
          "Đèn UV khử trùng vòi rửa + Sấy khô khí ấm + Sưởi ấm bệ ngồi"
        ]
      },
      {
        title: "Tủ Chậu Lavabo Gỗ Đa Lớp & Mặt Đá Corian",
        brand: "TUSLO",
        page: 17,
        catPage: "29–30",
        img: "assets/banners/lifestyle_bathroom_1.jpg",
        category: "Tủ chậu lavabo",
        desc: "Bộ sưu tập Tủ chậu Lavabo 2026 sử dụng gỗ tự nhiên đa lớp (Plywood) chống ẩm mốc vượt trội, kết hợp mặt bàn đá nhân tạo Arma Stone Corian liền khối.",
        highlights: [
          "Tủ gương thông minh tích hợp đèn LED cảm ứng vẫy tay / Radar",
          "Chức năng sấy khử sương mờ mặt gương sau khi tắm nước nóng",
          "Bản lề giảm chấn Inox 304 đóng mở êm ái trong môi trường ẩm"
        ]
      },
      {
        title: "Sen Tắm Phím Đàn, Màn Hình LED & Mạ PVD",
        brand: "TUSLO",
        page: 25,
        catPage: "45–46",
        img: "assets/banners/tech_sen_tam.jpg",
        category: "Sen tắm",
        desc: "Thân sen đúc từ đồng thau nguyên chất H59 hoặc hợp kim cao cấp, bề mặt mạ Niken-Crom nhiều lớp và PVD màu Xám Gunmetal / Vàng xước chống ăn mòn.",
        highlights: [
          "Màn hình LED hiển thị nhiệt độ nước tức thì (chạy bằng tua-bin nước)",
          "Bộ chia nước phím đàn trực quan kèm vòi xịt vệ sinh tích hợp",
          "Bát sen ABS cao cấp trộn khí (Air-Power) tạo tia nước êm dịu"
        ]
      },
      {
        title: "Vòi Lavabo & Vòi Cảm Ứng Tiết Kiệm Nước",
        brand: "TUSLO",
        page: 22,
        catPage: "39–40",
        img: "assets/banners/tech_voi_cam_ung.jpg",
        category: "Vòi cảm ứng",
        desc: "Ứng dụng mắt cảm biến hồng ngoại siêu nhạy tự động ngắt nước sau khi rời tay, cùng đầu vòi tạo bọt khí chống văng bắn và tiết kiệm nước tối ưu.",
        highlights: [
          "Cảm ứng hồng ngoại không chạm — ngăn ngừa lây nhiễm chéo",
          "Hỗ trợ nguồn kép Điện 220V & Pin DC 6V linh hoạt mọi công trình",
          "Lớp mạ PVD & Crom sáng bóng bền bỉ qua hàng trăm nghìn lần đóng mở"
        ]
      },
      {
        title: "Chậu Rửa Chén Sóng Siêu Âm & UV D012",
        brand: "LUSHINE",
        page: 37,
        catPage: "69–70",
        img: "assets/banners/tech_chau_rua_chen.jpg",
        category: "Chậu rửa chén",
        desc: "Giải pháp nhà bếp thông minh LUSHINE tích hợp bộ phát sóng siêu âm tần số cao và đèn UV khử khuẩn trực tiếp trong lòng chậu Inox 304 dày dặn.",
        highlights: [
          "Loại bỏ dư lượng thuốc trừ sâu, mảng bám trên rau củ & hải sản",
          "Bề mặt Inox 304 dập nổi hạt Linen / phủ Nano PVD chống trầy xước",
          "Đi kèm trọn bộ phụ kiện: thớt, rổ inox, chậu phụ & xi-phông thoát mùi"
        ]
      },
      {
        title: "Chậu Bếp Đá Nhân Tạo Granite Chống Trầy",
        brand: "LUSHINE",
        page: 38,
        catPage: "71–72",
        img: "assets/banners/tech_chau_da_nhan_tao.jpg",
        category: "Chậu rửa chén",
        desc: "Chậu rửa chén đá nhân tạo (80% bột đá thạch anh tự nhiên kết hợp 20% nhựa Acrylic PMMA) mang lại độ cứng vượt trội, chịu nhiệt và kháng khuẩn.",
        highlights: [
          "Chống trầy xước, chống thấm màu thực phẩm và chịu sốc nhiệt cao",
          "Bề mặt vân đá sang trọng, triệt tiêu tiếng ồn khi xả nước",
          "Thiết kế bo góc R15 dễ dàng vệ sinh và thoát nước nhanh"
        ]
      },
      {
        title: "Vòi Bếp Cảm Ứng & Dây Rút Đa Chế Độ",
        brand: "LUSHINE",
        page: 39,
        catPage: "73–74",
        img: "assets/banners/tech_voi_bep.jpg",
        category: "Vòi bếp",
        desc: "Bộ sưu tập Vòi bếp LUSHINE trang bị đầu vòi dây rút xoay 360° linh hoạt, cảm biến vẫy tay bật/tắt nước và màn hình hiển thị nhiệt độ nước.",
        highlights: [
          "Đầu vòi kéo dài linh hoạt với 2–3 chế độ tia nước (xả mạnh / phun mưa)",
          "Chất liệu Đồng thau mạ PVD & Inox 304 chuẩn an toàn nước uống",
          "Cảm ứng không chạm tiện lợi khi tay đang dính dầu mỡ"
        ]
      }
    ];

    grid.innerHTML = techItems
      .map(
        (t) => `
      <article class="tech-card">
        <div class="tech-card-media" onclick="app.openPageInExplorer(${t.page})" title="Nhấn để xem Trang PDF ${t.page} (Cat ${t.catPage})">
          <span class="combo-tier-badge">${t.brand} • TRANG PDF ${t.page} (CAT ${t.catPage})</span>
          <img src="${t.img}" alt="${t.title}" loading="lazy" />
        </div>
        <div class="tech-card-body">
          <h3>${t.title}</h3>
          <p>${t.desc}</p>
          <ul class="tech-highlights">
            ${t.highlights.map((h) => `<li>${h}</li>`).join("")}
          </ul>
          <div style="display:flex; gap:8px; margin-top:auto;">
            <button class="icon-btn" onclick="app.openPageInExplorer(${t.page})">📖 Xem Trang PDF ${t.page}</button>
            <button class="icon-btn primary" onclick="app.selectCategory('${t.category}')">🏺 Xem sản phẩm ${t.category}</button>
          </div>
        </div>
      </article>
    `
      )
      .join("");
  }

  // ==========================================================================
  // 3D LIFESTYLE LOOKBOOK & SPACE INSPIRATION SECTION (PAGES 5–10 & 47–49)
  // ==========================================================================
  const LOOKBOOK_SPACES = [
    {
      id: "lb-05",
      zone: "BATH",
      brand: "TUSLO",
      page: 5,
      catPage: "05–06",
      title: "Không Gian Phòng Tắm Hiện Đại",
      subtitle: "Tinh tế trong từng trải nghiệm sử dụng hằng ngày",
      quote: "Phối cảnh phòng tắm Master hiện đại với hệ bàn đá lavabo đôi, gương LED oval cảm ứng, vách tắm kính sen âm tường và khu vệ sinh thông minh đồng bộ.",
      img: "assets/pages/page_05.jpg",
      productCodes: ["E003 Luxury", "C013 Luxury", "L010", "F004 Luxury", "S017 Luxury"]
    },
    {
      id: "lb-06",
      zone: "BATH",
      brand: "TUSLO",
      page: 6,
      catPage: "07–08",
      title: "Ngôi Nhà Không Chỉ Để Ở",
      subtitle: "Phòng tắm đủ sạch và thư thái để bắt đầu hoặc kết thúc ngày mới nhẹ hơn",
      quote: "Một ngôi nhà đẹp không nhất thiết phải quá cầu kỳ. Nó chỉ cần đúng những gì gia đình thực sự dùng: bồn tắm massage Acrylic ngọc trai tích hợp vòi sen thư giãn tuyệt đối.",
      img: "assets/pages/page_06.jpg",
      productCodes: ["B004 Luxury", "S022 Luxury", "F001 Luxury", "A095"]
    },
    {
      id: "lb-07",
      zone: "BATH",
      brand: "TUSLO",
      page: 7,
      catPage: "09–10",
      title: "Khởi Đầu Ngày Mới: Sáng – Sạch – Dịu",
      subtitle: "Cảm giác mọi thứ được đặt đúng chỗ và vận hành một cách tự nhiên",
      quote: "Một chiếc gương đủ sáng, một dòng nước êm và những bề mặt dễ lau sạch khiến điều đó trở nên tự nhiên hơn rất nhiều.",
      img: "assets/pages/page_07.jpg",
      productCodes: ["B005 Luxury", "C007 Luxury", "L005", "F004 Luxury", "E004 Luxury"]
    },
    {
      id: "lb-08",
      zone: "KITCHEN",
      brand: "LUSHINE",
      page: 8,
      catPage: "11–12",
      title: "Không Gian Sống Hiện Đại Cho Gia Đình Việt",
      subtitle: "Hiểu nhu cầu thật để mang đến lựa chọn đúng hơn cho từng tổ ấm",
      quote: "Với nền tảng phân phối vật liệu xây dựng hơn hai thập kỷ, Hoa Sen Home mang đến giải pháp thiết bị bếp LUSHINE hợp nhu cầu, hợp ngân sách, rõ nguồn gốc và yên tâm sử dụng lâu dài.",
      img: "assets/pages/page_08.jpg",
      productCodes: ["D007", "D006", "K002 Luxury", "K010"]
    },
    {
      id: "lb-09",
      zone: "KITCHEN",
      brand: "LUSHINE",
      page: 9,
      catPage: "13–14",
      title: "Nâng Tầm Gian Bếp — Gắn Kết Gia Đình",
      subtitle: "Family Kitchen: Nơi nấu ăn, trò chuyện và giữ nhịp ấm cho cả nhà",
      quote: "Khi khu rửa sạch sẽ, vòi bếp thuận tay và mọi chi tiết quanh chậu được sắp hợp lý, căn bếp tự nhiên trở thành nơi dễ ở hơn nhiều.",
      img: "assets/pages/page_09.jpg",
      productCodes: ["D012", "K014", "K005", "D001"]
    },
    {
      id: "lb-10",
      zone: "KITCHEN",
      brand: "LUSHINE",
      page: 10,
      catPage: "15–16",
      title: "Chủ Nghĩa Tối Giản Hiện Đại",
      subtitle: "Ít hơn để mỗi chi tiết đẹp hơn và dễ sống hơn",
      quote: "Khi bảng màu tiết chế, vật liệu đồng điệu và thiết bị được chọn đúng tỷ lệ, căn nhà sẽ tự nhiên sang hơn mà không trở nên xa cách.",
      img: "assets/pages/page_10.jpg",
      productCodes: ["D008", "D006", "K013", "K004"]
    },
    {
      id: "lb-47",
      zone: "BATH",
      brand: "TUSLO",
      page: 47,
      catPage: "89–90",
      title: "Phối Cảnh Phòng Tắm Master Luxury",
      subtitle: "Sự giao thoa giữa đá tự nhiên, bồn tắm độc lập và bồn cầu thông minh",
      quote: "Không gian phòng tắm chuẩn Resort 5 sao với bồn tắm đặt sàn B004 Luxury, bồn cầu thông minh E003 Luxury và hệ tủ chậu gương LED cảm ứng.",
      img: "assets/pages/page_47.jpg",
      productCodes: ["B004 Luxury", "E003 Luxury", "C007 Luxury", "F004 Luxury"]
    },
    {
      id: "lb-48",
      zone: "BATH",
      brand: "TUSLO",
      page: 48,
      catPage: "91–92",
      title: "Không Gian Phòng Tắm Đô Thị Tinh Giản",
      subtitle: "Tối ưu công năng, chống ẩm tuyệt đối và dễ dàng vệ sinh",
      quote: "Giải pháp hoàn hảo cho căn hộ và nhà phố hiện đại với tủ chậu C001 Luxury, bồn cầu 1 khối xả xoáy T005 và buồng tắm vách kính tích hợp sen cây S009.",
      img: "assets/pages/page_48.jpg",
      productCodes: ["C001 Luxury", "T005", "M004", "S009", "A083 Pro"]
    },
    {
      id: "lb-49",
      zone: "BATH",
      brand: "TUSLO",
      page: 49,
      catPage: "93–94",
      title: "Tổ Ấm Đồng Bộ Vật Liệu Từ Hoa Sen Home",
      subtitle: "Kết nối hài hòa giữa không gian nội thất và phòng tắm tiện nghi",
      quote: "Đồng bộ từ gạch ốp lát, thiết bị vệ sinh TUSLO đến phụ kiện phòng tắm Inox 304 chính hãng tại hệ thống Siêu thị Hoa Sen Home toàn quốc.",
      img: "assets/pages/page_49.jpg",
      productCodes: ["C013 Luxury", "T005", "S001 Luxury", "A091", "A095"]
    }
  ];

  function renderLookbookSection() {
    const grid = document.getElementById("lookbookGrid");
    if (!grid) return;

    const list =
      state.lookbookFilter === "ALL"
        ? LOOKBOOK_SPACES
        : LOOKBOOK_SPACES.filter((x) => x.zone === state.lookbookFilter);

    grid.innerHTML = list
      .map((item) => {
        const chipsHTML = (item.productCodes || [])
          .map((code) => {
            const p = DATA.products.find(
              (prod) => prod.ma_san_pham === code || prod.ma_goc === code
            );
            if (!p) return "";
            return `
              <button class="lookbook-tag-chip" onclick="app.openProductModal('${p.id}')" title="${p.ma_san_pham} — ${p.ten_san_pham} (${p.gia_niem_yet})">
                🏷️ ${p.ma_san_pham} (${p.gia_niem_yet})
              </button>
            `;
          })
          .join("");

        return `
          <article class="lookbook-card">
            <div class="lookbook-media" onclick="app.openLightbox('${item.img}', '${item.title} — Trang PDF ${item.page} (Cat ${item.catPage})')" title="Nhấn để phóng to phối cảnh toàn màn hình">
              <span class="combo-tier-badge">${item.brand} • TRANG PDF ${item.page} (CAT ${item.catPage})</span>
              <img src="${item.img}" alt="${item.title}" loading="lazy" />
            </div>
            <div class="lookbook-body">
              <div class="lookbook-sub">${item.subtitle}</div>
              <h3>${item.title}</h3>
              <p class="lookbook-quote">“${item.quote}”</p>
              <div style="font-size:0.74rem; font-weight:800; color:var(--text-muted); margin-bottom:6px;">
                ✨ GỢI Ý THIẾT BỊ TRONG KHÔNG GIAN (NHẤN ĐỂ XEM CHI TIẾT):
              </div>
              <div class="lookbook-tags">
                ${chipsHTML}
              </div>
              <div style="display:flex; gap:8px; margin-top:auto;">
                <button class="icon-btn" onclick="app.openLightbox('${item.img}', '${item.title} — Trang PDF ${item.page}')">🔍 Phóng to ảnh 3D</button>
                <button class="icon-btn primary" onclick="app.openPageInExplorer(${item.page})">📖 Mở Trang PDF ${item.page} (Cat ${item.catPage})</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  // ==========================================================================
  // 51-PAGE ORIGINAL CATALOGUE SPREAD EXPLORER
  // ==========================================================================
  const CATALOGUE_TOC_CHAPTERS = [
    { label: "📕 Bìa & Cam kết", page: 1, cat: "01" },
    { label: "📑 Mục lục", page: 4, cat: "03" },
    { label: "🏛️ Cảm hứng sống", page: 5, cat: "05" },
    { label: "🚽 Bồn cầu", page: 11, cat: "17" },
    { label: "✨ Bồn cầu thông minh", page: 15, cat: "25" },
    { label: "🪞 Tủ gương Lavabo", page: 17, cat: "29" },
    { label: "💧 Lavabo", page: 19, cat: "33" },
    { label: "🚰 Vòi lavabo", page: 22, cat: "39" },
    { label: "🚿 Sen tắm", page: 25, cat: "45" },
    { label: "💡 Gương LED", page: 28, cat: "51" },
    { label: "🛁 Bồn tắm", page: 29, cat: "53" },
    { label: "🧻 Phụ kiện nhà tắm", page: 32, cat: "59" },
    { label: "🍽️ Chậu rửa chén Lushine", page: 36, cat: "67" },
    { label: "🚰 Vòi bếp Lushine", page: 39, cat: "73" },
    { label: "🛋️ 11 Combo nhà tắm", page: 41, cat: "77" },
    { label: "🖼️ Lookbook thực tế", page: 47, cat: "89" }
  ];

  function initCatalogueExplorer() {
    const select = document.getElementById("explorerPageSelect");
    const thumbs = document.getElementById("explorerThumbsList");
    const tocBar = document.getElementById("explorerTocBar");

    if (tocBar) {
      tocBar.innerHTML =
        `<span style="font-size:0.74rem; font-weight:800; color:var(--gold-light); white-space:nowrap; margin-right:4px;">MỤC LỤC NHANH:</span>` +
        CATALOGUE_TOC_CHAPTERS.map(
          (ch) =>
            `<button class="toc-jump-pill" data-toc-page="${ch.page}" onclick="app.goToExplorerPage(${ch.page})">${ch.label} (T.${ch.page})</button>`
        ).join("");
    }

    if (select) {
      select.innerHTML = DATA.pages
        .map(
          (pg) =>
            `<option value="${pg.trang_pdf}">Trang PDF ${pg.trang_pdf}/51 (Cat ${pg.trang_catalogue}) — ${pg.chuyen_muc} ${pg.so_san_pham ? `[${pg.so_san_pham} SP]` : (pg.combos && pg.combos.length ? `[${pg.combos.length} Combo]` : "")}</option>`
        )
        .join("");
    }

    if (thumbs) {
      thumbs.innerHTML = DATA.pages
        .map(
          (pg) => `
        <div class="page-thumb-item ${pg.trang_pdf === state.explorerPage ? "active" : ""}" id="expThumb_${pg.trang_pdf}" onclick="app.goToExplorerPage(${pg.trang_pdf})">
          <img src="${pg.hinh_anh}" alt="Trang ${pg.trang_pdf}" loading="lazy" />
          <div style="min-width:0;">
            <div style="font-size:0.78rem; font-weight:700; color:#fff;">Trang PDF ${pg.trang_pdf} <span style="color:var(--gold-light);">(Cat ${pg.trang_catalogue})</span></div>
            <div style="font-size:0.72rem; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${pg.chuyen_muc}</div>
            ${pg.so_san_pham > 0 ? `<span style="font-size:0.68rem; color:#fbbf24; font-weight:700;">${pg.so_san_pham} sản phẩm</span>` : ""}
            ${pg.combos && pg.combos.length > 0 ? `<span style="font-size:0.68rem; color:#fbbf24; font-weight:700;">🛋️ ${pg.combos.length} Combo (${pg.combos.map((c) => c.ma_combo).join(", ")})</span>` : ""}
          </div>
        </div>
      `
        )
        .join("");
    }

    goToExplorerPage(state.explorerPage);
  }

  function goToExplorerPage(pno, highlightProdId = null) {
    const validPno = Math.max(1, Math.min(51, pno));
    state.explorerPage = validPno;
    state.highlightedProductId = highlightProdId;

    const pg = DATA.pages.find((x) => x.trang_pdf === validPno);
    if (!pg) return;

    const select = document.getElementById("explorerPageSelect");
    if (select) select.value = String(validPno);

    const titleEl = document.getElementById("explorerPageTitle");
    if (titleEl) {
      titleEl.textContent = `Trang PDF ${pg.trang_pdf} / 51 (Trang Catalogue: ${pg.trang_catalogue}) — ${pg.tieu_de}`;
    }

    const imgEl = document.getElementById("explorerSpreadImage");
    if (imgEl) {
      imgEl.src = pg.hinh_anh;
    }

    // Highlight active thumb
    document.querySelectorAll(".page-thumb-item").forEach((el) => el.classList.remove("active"));
    const activeThumb = document.getElementById("expThumb_" + validPno);
    if (activeThumb) {
      activeThumb.classList.add("active");
      activeThumb.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    // Highlight active TOC pill
    let currentChapterPage = 1;
    CATALOGUE_TOC_CHAPTERS.forEach((ch) => {
      if (validPno >= ch.page) currentChapterPage = ch.page;
    });
    document.querySelectorAll(".toc-jump-pill").forEach((btn) => {
      btn.classList.toggle("active", parseInt(btn.getAttribute("data-toc-page"), 10) === currentChapterPage);
    });

    // Render Hotspots on Spread (Products + Combos)
    const hotspotsLayer = document.getElementById("explorerHotspotsLayer");
    if (hotspotsLayer) {
      const prodHotspots = (pg.san_pham || [])
        .map((sp) => {
          const b = sp.bbox_page || { x: 10, y: 10, w: 20, h: 20 };
          const isHi = sp.id === highlightProdId;
          return `
          <div
            class="spread-hotspot ${isHi ? "highlighted" : ""}"
            style="left:${b.x}%; top:${b.y}%; width:${b.w}%; height:${b.h}%;"
            onclick="app.openProductModal('${sp.id}')"
            title="${sp.ma_san_pham} - ${sp.ten_san_pham} (${sp.gia_niem_yet})"
          >
            <span class="hotspot-label">${sp.ma_san_pham} • ${sp.gia_niem_yet}</span>
          </div>
        `;
        })
        .join("");

      const comboHotspots = (pg.combos || [])
        .map((c) => {
          const b = c.bbox_page || { x: 50, y: 5, w: 45, h: 45 };
          return `
          <div
            class="spread-hotspot"
            style="left:${b.x}%; top:${b.y}%; width:${b.w}%; height:${b.h}%;"
            onclick="app.openComboModal('${c.ma_combo}')"
            title="Nhấn để xem chi tiết ${c.ten_combo} (${c.tong_gia_tri_fmt})"
          >
            <span class="hotspot-label">🛋️ Combo ${c.ma_combo} (${c.so_luong_san_pham || ""} món) • ${c.tong_gia_tri_fmt}</span>
          </div>
        `;
        })
        .join("");

      hotspotsLayer.innerHTML = prodHotspots + comboHotspots;
    }

    // Render Right Panel Product / Combo List
    const countEl = document.getElementById("explorerPageProdCount");
    const listEl = document.getElementById("explorerPageProductsList");
    const totalOnPage =
      (pg.san_pham || []).length > 0
        ? (pg.san_pham || []).length
        : (pg.combos || []).reduce((acc, c) => acc + (c.so_luong_san_pham || 0), 0);
    if (countEl) countEl.textContent = totalOnPage;

    if (listEl) {
      if ((pg.san_pham || []).length > 0) {
        listEl.innerHTML = pg.san_pham
          .map(
            (sp) => `
          <div class="page-prod-item" onclick="app.openProductModal('${sp.id}')" style="${sp.id === highlightProdId ? "border:2px solid #ff3b30; background:rgba(255,59,48,0.18);" : ""}">
            <img src="${sp.hinh_anh}" alt="${sp.ma_san_pham}" loading="lazy" />
            <div style="min-width:0; flex:1;">
              <div style="font-weight:800; color:#fff; font-size:0.86rem;">${sp.ma_san_pham}</div>
              <div style="font-size:0.74rem; color:#cbd5e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sp.ten_san_pham}</div>
              <div style="font-size:0.78rem; color:var(--gold-light); font-weight:700;">${sp.gia_niem_yet}</div>
            </div>
          </div>
        `
          )
          .join("");
      } else if ((pg.combos || []).length > 0) {
        listEl.innerHTML = pg.combos
          .map((c) => {
            const fullCombo = DATA.combos.find((x) => x.ma_combo === c.ma_combo);
            const subItemsHTML = fullCombo
              ? (fullCombo.san_pham || [])
                  .map((it) => {
                    const pObj = DATA.products.find((p) => p.ma_san_pham === it.ma_san_pham);
                    const pid = pObj ? pObj.id : "";
                    return `
                      <div class="page-prod-item" onclick="${pid ? `app.openProductModal('${pid}')` : ""}" style="padding:6px 8px; margin-bottom:5px;">
                        <img src="${it.hinh_anh}" alt="${it.ma_san_pham}" style="width:36px; height:36px;" loading="lazy" />
                        <div style="min-width:0; flex:1;">
                          <div style="font-weight:800; color:#fff; font-size:0.78rem;">${it.ma_san_pham} <span style="color:#94a3b8; font-weight:500;">(${it.vai_tro})</span></div>
                          <div style="font-size:0.74rem; color:var(--gold-light); font-weight:700;">${it.gia_niem_yet}</div>
                        </div>
                      </div>
                    `;
                  })
                  .join("")
              : "";

            return `
              <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(212,168,79,0.4); border-radius:10px; padding:10px; margin-bottom:12px;">
                <div style="font-weight:800; color:var(--gold-light); font-size:0.9rem; cursor:pointer;" onclick="app.openComboModal('${c.ma_combo}')">
                  🛋️ ${c.ten_combo}
                </div>
                <div style="font-size:0.8rem; color:#f87171; font-weight:800; margin:4px 0 8px;">
                  Tổng giá (${c.so_luong_san_pham || ""} món): ${c.tong_gia_tri_fmt}
                </div>
                <div style="display:flex; gap:6px; margin-bottom:10px;">
                  <button class="icon-btn" style="flex:1; font-size:0.73rem;" onclick="app.openComboModal('${c.ma_combo}')">🔍 Chi tiết Combo</button>
                  <button class="icon-btn primary" style="flex:1; font-size:0.73rem;" onclick="app.addComboToQuote('${c.ma_combo}')">🧾 + Báo giá</button>
                </div>
                <div style="font-size:0.72rem; color:#cbd5e1; font-weight:700; margin-bottom:6px;">Danh sách thiết bị trong ${c.ma_combo}:</div>
                ${subItemsHTML}
              </div>
            `;
          })
          .join("");
      } else if (validPno === 15) {
        const smartProds = DATA.products.filter((p) => p.danh_muc === "Bồn cầu thông minh");
        listEl.innerHTML = `
          <div style="margin-bottom:10px; font-size:0.78rem; color:#cbd5e1;">
            Bảng đối chiếu 27 chức năng giữa 4 mẫu Bồn cầu thông minh TUSLO Luxury:
          </div>
          ${smartProds
            .map(
              (sp) => `
            <div class="page-prod-item" onclick="app.openProductModal('${sp.id}')">
              <img src="${sp.hinh_anh}" alt="${sp.ma_san_pham}" loading="lazy" />
              <div style="min-width:0; flex:1;">
                <div style="font-weight:800; color:#fff; font-size:0.86rem;">${sp.ma_san_pham}</div>
                <div style="font-size:0.74rem; color:#cbd5e1;">${sp.kich_thuoc}</div>
                <div style="font-size:0.78rem; color:var(--gold-light); font-weight:700;">${sp.gia_niem_yet}</div>
              </div>
            </div>
          `
            )
            .join("")}
          <button class="nav-btn primary" style="width:100%; margin-top:8px;" onclick="app.selectCategory('Bồn cầu thông minh')">
            🔍 Xem 4 Mẫu Bồn Cầu Thông Minh Trong Showroom
          </button>
        `;
      } else if (validPno === 4) {
        listEl.innerHTML = `
          <div style="margin-bottom:8px; font-size:0.78rem; color:#cbd5e1;">
            Nhấn vào từng chuyên mục trong Mục lục để mở nhanh trang tương ứng:
          </div>
          ${CATALOGUE_TOC_CHAPTERS.map(
            (ch) => `
            <div class="page-prod-item" onclick="app.goToExplorerPage(${ch.page})" style="padding:8px 10px;">
              <div style="font-weight:700; color:#fff; font-size:0.82rem;">${ch.label}</div>
              <div style="margin-left:auto; font-size:0.74rem; color:var(--gold-light); font-weight:700;">Trang PDF ${ch.page} (Cat ${ch.cat})</div>
            </div>
          `
          ).join("")}
        `;
      } else {
        listEl.innerHTML = `
          <div style="color:#94a3b8; font-size:0.82rem; padding:16px 8px; text-align:center;">
            Trang này là trang <strong>${pg.chuyen_muc}</strong> (${pg.tieu_de}).<br/><br/>
            <button class="nav-btn" style="width:100%; margin-bottom:8px;" onclick="app.openLightbox('${pg.hinh_anh}', 'Trang PDF ${pg.trang_pdf} — ${pg.tieu_de}')">
              🔍 Phóng to toàn màn hình Trang ${pg.trang_pdf}
            </button>
            Hãy chọn các trang có gắn nhãn <strong>[SP]</strong> trên thanh Mục lục nhanh hoặc danh sách bên trái để tương tác trực tiếp với từng sản phẩm.
          </div>
        `;
      }
    }
  }

  // ==========================================================================
  // PRODUCT DETAIL MODAL
  // ==========================================================================
  function openProductModal(productId) {
    const p = DATA.products.find((x) => x.id === productId);
    if (!p) return;

    const modal = document.getElementById("productDetailModal");
    const headerTitle = document.getElementById("modalHeaderTitle");
    const body = document.getElementById("productModalBody");

    headerTitle.innerHTML = `
      <span>${p.ma_san_pham} — ${p.ten_san_pham}</span>
      <span style="font-size:0.8rem; font-weight:600; color:var(--gold-primary); margin-left:10px;">
        [${p.thuong_hieu} • Trang PDF ${p.trang_pdf} / Cat ${p.trang_catalogue}]
      </span>
    `;

    // Smart toilet features if E001-E004
    let smartFeaturesHTML = "";
    if (p.danh_muc === "Bồn cầu thông minh") {
      const key = p.ma_goc; // E001, E002, E003, E004
      const activeFeats = DATA.smart_toilet_matrix.filter((row) => row[key]);
      smartFeaturesHTML = `
        <div style="margin-top:18px; background:#faf6ed; border:1px solid var(--border-gold); border-radius:12px; padding:14px;">
          <h4 style="font-size:0.92rem; font-weight:800; color:var(--text-primary); margin-bottom:10px;">
            ✨ ${activeFeats.length}/27 Tính năng Bồn cầu thông minh tích hợp trên ${p.ma_san_pham} (Đối chiếu Trang PDF 15):
          </h4>
          <div class="product-features-grid">
            ${activeFeats
              .map(
                (f) => `
              <div style="background:#fff; border:1px solid var(--border-light); border-radius:8px; padding:8px 10px;">
                <div style="font-weight:700; color:var(--text-primary);"><span style="color:#15803d; font-weight:800;">✔</span> ${f.stt}. ${f.tinh_nang}</div>
                <div style="font-size:0.74rem; color:var(--text-secondary); margin-top:2px;">${f.dien_giai || ""}</div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    // Combos containing this product
    let combosHTML = "";
    if (p.combos_su_dung && p.combos_su_dung.length > 0) {
      combosHTML = `
        <div style="margin-top:16px;">
          <h4 style="font-size:0.86rem; font-weight:800; color:var(--text-secondary); margin-bottom:8px;">
            🛋️ SẢN PHẨM NÀY ĐƯỢC SỬ DỤNG TRONG ${p.combos_su_dung.length} COMBO NHÀ TẮM:
          </h4>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${p.combos_su_dung
              .map(
                (c) => `
              <button class="nav-btn" onclick="app.closeProductModal(); app.openComboModal('${c.ma_combo}');">
                🛋️ Combo ${c.ma_combo} (Trang PDF ${c.trang_pdf})
              </button>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    // Related products
    const related = DATA.products
      .filter((x) => x.danh_muc === p.danh_muc && x.id !== p.id)
      .slice(0, 4);

    const b = p.bbox_page || { x: 10, y: 10, w: 20, h: 20 };

    body.innerHTML = `
      <div class="detail-grid">
        <!-- Left Media Column -->
        <div>
          <div class="detail-media-stage" id="detailMediaStage" style="cursor:zoom-in;" title="Nhấn vào ảnh để phóng to toàn màn hình" onclick="app.openLightbox(document.getElementById('detailMainImg')?.src || '${p.hinh_anh}', '${p.ma_san_pham} — ${p.ten_san_pham}')">
            <img id="detailMainImg" src="${p.hinh_anh}" alt="${p.ma_san_pham}" />
          </div>
          <div style="text-align:center; font-size:0.74rem; color:var(--text-muted); margin-top:4px;">
            🔍 Nhấn vào hình ảnh hoặc bản vẽ để phóng to độ phân giải cao
          </div>

          <div class="media-tabs">
            <button class="media-tab-btn active" onclick="app.switchDetailMedia(this, 'photo', '${p.hinh_anh}')">
              📷 Ảnh sản phẩm
            </button>
            ${
              p.ban_ve_ky_thuat
                ? `<button class="media-tab-btn" onclick="app.switchDetailMedia(this, 'drawing', '${p.ban_ve_ky_thuat}')">
                    📐 Bản vẽ kỹ thuật
                  </button>`
                : ""
            }
            <button class="media-tab-btn" onclick="app.switchDetailMedia(this, 'spread', 'assets/pages/page_${String(p.trang_pdf).padStart(2, "0")}.jpg', ${b.x}, ${b.y}, ${b.w}, ${b.h})">
              📖 Vị trí trên trang Catalogue gốc (T.${p.trang_pdf})
            </button>
            <button class="media-tab-btn" onclick="app.openARModal('${p.id}')">
              📱 Trải nghiệm AR 3D
            </button>
          </div>
        </div>

        <!-- Right Specs Column -->
        <div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
            <span class="p-badge luxury">${p.thuong_hieu}</span>
            <span class="p-badge col2026">${p.bo_suu_tap}</span>
            ${(p.badges || []).map((bg) => `<span class="p-badge bestseller">${bg}</span>`).join("")}
          </div>

          <h2 style="font-size:1.65rem; font-weight:800; margin-bottom:2px;">${p.ma_san_pham}</h2>
          <p style="font-size:1rem; color:var(--text-secondary); font-weight:600; margin-bottom:12px;">${p.ten_san_pham} — ${p.loai_phu}</p>

          <div style="background:linear-gradient(135deg, #fff9eb, #f7edd4); border:1px solid var(--border-gold); border-radius:12px; padding:14px 18px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="font-size:0.76rem; color:#7d5a10; font-weight:700; text-transform:uppercase;">Giá niêm yết Catalogue 2026</div>
              <div style="font-size:1.6rem; font-weight:800; color:var(--crimson-primary);">${p.gia_niem_yet}</div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="nav-btn primary" onclick="app.addToQuote('${p.id}', 1); app.openProductModal('${p.id}');">
                🧾 ${state.quoteItems[p.id] ? `Đã chọn Báo giá (${state.quoteItems[p.id]})` : "+ Thêm vào Báo Giá"}
              </button>
              <button class="nav-btn" onclick="app.toggleCompare('${p.id}'); app.openProductModal('${p.id}');">
                ${state.compareIds.includes(p.id) ? "✓ Đang so sánh" : "⚖️ So sánh"}
              </button>
              <button class="nav-btn" onclick="app.openARModal('${p.id}')">
                📱 Trải nghiệm AR 3D
              </button>
              <button class="nav-btn" onclick="app.closeProductModal(); app.openPageInExplorer(${p.trang_pdf}, '${p.id}');">
                📖 Xem Trang PDF ${p.trang_pdf}
              </button>
            </div>
          </div>

          <table class="detail-specs-table">
            <tbody>
              <tr><th>Mã sản phẩm</th><td><strong>${p.ma_san_pham}</strong></td></tr>
              <tr><th>Danh mục</th><td>${p.danh_muc} ${p.danh_muc_phu && p.danh_muc_phu.length ? `(${p.danh_muc_phu.join(", ")})` : ""}</td></tr>
              <tr><th>Phân loại</th><td>${p.loai_phu}</td></tr>
              <tr><th>Bộ sưu tập</th><td>${p.bo_suu_tap}</td></tr>
              <tr><th>Kích thước</th><td><strong>${p.kich_thuoc}</strong></td></tr>
              <tr><th>Chất liệu</th><td>${p.chat_lieu}</td></tr>
              <tr><th>Bề mặt hoàn thiện</th><td>${p.be_mat}</td></tr>
              ${p.che_do_nuoc ? `<tr><th>Chế độ nước</th><td>${p.che_do_nuoc}</td></tr>` : ""}
              <tr><th>Vị trí Catalogue</th><td>Trang PDF <strong>${p.trang_pdf} / 51</strong> (Trang in Catalogue: <strong>${p.trang_catalogue}</strong>)</td></tr>
              ${p.ghi_chu ? `<tr><th>Ghi chú</th><td style="color:var(--crimson-primary); font-weight:600;">${p.ghi_chu}</td></tr>` : ""}
            </tbody>
          </table>

          <div style="background:var(--bg-elevated); border-radius:10px; padding:12px 14px;">
            <div style="font-size:0.8rem; font-weight:800; color:var(--text-secondary); margin-bottom:6px;">
              📋 THÔNG SỐ NGUYÊN BẢN TRÊN CATALOGUE:
            </div>
            <ul style="padding-left:18px; font-size:0.85rem; color:var(--text-primary);">
              ${(p.thong_so_ky_thuat || []).map((line) => `<li style="margin-bottom:4px;">${line}</li>`).join("")}
            </ul>
          </div>

          ${combosHTML}
        </div>
      </div>

      ${smartFeaturesHTML}

      ${
        related.length > 0
          ? `
        <div style="margin-top:26px; padding-top:18px; border-top:1px solid var(--border-light);">
          <h4 style="font-size:0.95rem; font-weight:800; margin-bottom:12px;">🔄 Sản phẩm cùng danh mục ${p.danh_muc}</h4>
          <div class="related-products-grid">
            ${related
              .map(
                (r) => `
              <div class="combo-item-chip" onclick="app.openProductModal('${r.id}')" style="padding:10px;">
                <img src="${r.hinh_anh}" alt="${r.ma_san_pham}" style="width:48px; height:48px;" />
                <div>
                  <div style="font-weight:800; font-size:0.9rem;">${r.ma_san_pham}</div>
                  <div style="font-size:0.75rem; color:var(--text-muted);">${r.ten_san_pham}</div>
                  <div style="font-size:0.82rem; font-weight:700; color:var(--crimson-primary);">${r.gia_niem_yet}</div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
          : ""
      }
    `;

    modal.classList.add("open");
  }

  function switchDetailMedia(btnEl, mode, src, bx, by, bw, bh) {
    const stage = document.getElementById("detailMediaStage");
    if (!stage) return;

    btnEl.parentElement.querySelectorAll(".media-tab-btn").forEach((b) => b.classList.remove("active"));
    btnEl.classList.add("active");

    if (mode === "spread") {
      stage.innerHTML = `
        <div style="position:relative; display:inline-block; width:100%;">
          <img src="${src}" alt="Catalogue Spread" style="width:100%; height:auto; max-height:none; border-radius:8px;" />
          <div style="position:absolute; left:${bx}%; top:${by}%; width:${bw}%; height:${bh}%; border:3px solid #ff3b30; background:rgba(255,59,48,0.2); border-radius:6px; box-shadow:0 0 0 6px rgba(255,59,48,0.3);"></div>
        </div>
      `;
    } else {
      stage.innerHTML = `<img id="detailMainImg" src="${src}" alt="Product Media" />`;
    }
  }

  function closeProductModal() {
    const modal = document.getElementById("productDetailModal");
    if (modal) modal.classList.remove("open");
  }

  // ==========================================================================
  // COMBO DETAIL MODAL & FULLSCREEN LIGHTBOX
  // ==========================================================================
  function openComboModal(maCombo) {
    const cb = DATA.combos.find((x) => x.ma_combo === maCombo);
    if (!cb) return;

    const modal = document.getElementById("comboDetailModal");
    const headerTitle = document.getElementById("comboModalHeaderTitle");
    const body = document.getElementById("comboModalBody");

    headerTitle.innerHTML = `
      <span>🛋️ ${cb.ten_combo} (${cb.phan_khuc} Series)</span>
      <span style="font-size:0.8rem; font-weight:600; color:var(--gold-primary); margin-left:10px;">
        [Trang PDF ${cb.trang_pdf} • Cat ${cb.trang_catalogue} • ${cb.so_luong_san_pham} sản phẩm đồng bộ]
      </span>
    `;

    const itemsRows = (cb.san_pham || [])
      .map((it, idx) => {
        const prodObj = DATA.products.find((p) => p.ma_san_pham === it.ma_san_pham);
        const pid = prodObj ? prodObj.id : "";
        return `
        <tr>
          <td style="font-weight:700; color:var(--text-muted);">${idx + 1}</td>
          <td style="width:68px;">
            <img src="${it.hinh_anh}" alt="${it.ma_san_pham}" style="width:52px; height:52px; object-fit:contain; background:#fff; border:1px solid var(--border-light); border-radius:6px; padding:2px; cursor:pointer;" onclick="${pid ? `app.closeComboModal(); app.openProductModal('${pid}')` : ""}" />
          </td>
          <td>
            <div style="font-weight:800; color:var(--text-primary); cursor:pointer;" onclick="${pid ? `app.closeComboModal(); app.openProductModal('${pid}')` : ""}">${it.ma_san_pham}</div>
            <div style="font-size:0.74rem; color:var(--text-muted);">${prodObj ? prodObj.bo_suu_tap : ""}</div>
          </td>
          <td style="font-weight:600;">${it.vai_tro}</td>
          <td style="font-size:0.8rem; color:var(--text-secondary);">${prodObj ? prodObj.kich_thuoc : "—"}</td>
          <td style="font-size:0.8rem; color:var(--text-secondary);">${prodObj ? prodObj.chat_lieu : "—"}</td>
          <td style="font-weight:800; color:var(--crimson-primary);">${it.gia_niem_yet}</td>
          <td>
            ${
              pid
                ? `<button class="icon-btn primary" onclick="app.closeComboModal(); app.openProductModal('${pid}')">Chi tiết</button>`
                : ""
            }
          </td>
        </tr>
      `;
      })
      .join("");

    body.innerHTML = `
      <div class="combo-modal-grid">
        <div>
          <div style="border-radius:12px; overflow:hidden; border:1px solid var(--border-gold); cursor:zoom-in;" onclick="app.openLightbox('${cb.hinh_anh}', '${cb.ten_combo} — Trang PDF ${cb.trang_pdf}')">
            <img src="${cb.hinh_anh}" alt="${cb.ten_combo}" style="width:100%; height:auto; display:block;" />
          </div>
          <div style="text-align:center; font-size:0.74rem; color:var(--text-muted); margin-top:6px;">
            🔍 Nhấn vào ảnh phối cảnh Combo để phóng to toàn màn hình
          </div>
          <div style="margin-top:14px; background:#faf6ed; border:1px solid var(--border-gold); border-radius:12px; padding:14px;">
            <div style="font-size:0.78rem; font-weight:800; color:#7d5a10; text-transform:uppercase;">Tổng giá trị niêm yết (${cb.so_luong_san_pham} thiết bị)</div>
            <div style="font-size:1.6rem; font-weight:800; color:var(--crimson-primary); margin:4px 0;">${cb.tong_gia_tri_fmt}</div>
            <p style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:12px;">${cb.mo_ta}</p>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="nav-btn primary" onclick="app.addComboToQuote('${cb.ma_combo}'); app.closeComboModal(); app.openQuoteModal();">
                🧾 Chọn Trọn Bộ Combo Vào Báo Giá
              </button>
              <button class="nav-btn" onclick="app.closeComboModal(); app.openPageInExplorer(${cb.trang_pdf});">
                📖 Xem Trang Catalogue Gốc (T.${cb.trang_pdf})
              </button>
            </div>
          </div>
        </div>

        <div>
          <h4 style="font-size:0.96rem; font-weight:800; margin-bottom:10px;">
            📋 Danh mục ${cb.so_luong_san_pham} thiết bị đồng bộ trong ${cb.ten_combo}
          </h4>
          <div style="overflow-x:auto; max-height:540px; border:1px solid var(--border-light); border-radius:12px;">
            <table class="matrix-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ảnh</th>
                  <th>Mã SP</th>
                  <th>Hạng mục</th>
                  <th>Kích thước</th>
                  <th>Chất liệu</th>
                  <th>Giá niêm yết</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    modal.classList.add("open");
  }

  function closeComboModal() {
    const modal = document.getElementById("comboDetailModal");
    if (modal) modal.classList.remove("open");
  }

  function openLightbox(src, title) {
    if (!src) return;
    const modal = document.getElementById("lightboxModal");
    const img = document.getElementById("lightboxImg");
    const titleEl = document.getElementById("lightboxTitle");
    if (img) img.src = src;
    if (titleEl) titleEl.textContent = "🔍 " + (title || "Phóng to hình ảnh / bản vẽ");
    if (modal) modal.classList.add("open");
  }

  function closeLightbox() {
    const modal = document.getElementById("lightboxModal");
    if (modal) modal.classList.remove("open");
  }

  // ==========================================================================
  // PRODUCT COMPARISON TRAY & MODAL
  // ==========================================================================
  function toggleCompare(productId) {
    const idx = state.compareIds.indexOf(productId);
    if (idx >= 0) {
      state.compareIds.splice(idx, 1);
    } else {
      if (state.compareIds.length >= 4) {
        alert("Bạn có thể chọn tối đa 4 sản phẩm để so sánh cùng lúc.");
        return;
      }
      state.compareIds.push(productId);
    }
    updateCompareTray();
    renderFilteredProducts();
  }

  function updateCompareTray() {
    const tray = document.getElementById("compareTray");
    const countEl = document.getElementById("compareCount");
    const itemsEl = document.getElementById("compareTrayItems");

    if (!tray) return;
    countEl.textContent = state.compareIds.length;

    if (state.compareIds.length === 0) {
      tray.classList.remove("visible");
      return;
    }

    tray.classList.add("visible");
    itemsEl.innerHTML = state.compareIds
      .map((id) => {
        const p = DATA.products.find((x) => x.id === id);
        if (!p) return "";
        return `
        <div class="compare-mini-slot">
          <img src="${p.hinh_anh}" alt="${p.ma_san_pham}" />
          <span><strong>${p.ma_san_pham}</strong></span>
          <button onclick="app.toggleCompare('${p.id}')" title="Xóa">✕</button>
        </div>
      `;
      })
      .join("");
  }

  function clearComparison() {
    state.compareIds = [];
    updateCompareTray();
    renderFilteredProducts();
  }

  function openCompareModal() {
    if (state.compareIds.length < 1) return;
    const modal = document.getElementById("compareModal");
    const body = document.getElementById("compareModalBody");

    const prods = state.compareIds
      .map((id) => DATA.products.find((x) => x.id === id))
      .filter(Boolean);

    const rows = [
      { label: "Hình ảnh & Bản vẽ", render: (p) => `
        <div style="text-align:center;">
          <img src="${p.hinh_anh}" alt="${p.ma_san_pham}" style="height:130px; object-fit:contain; margin-bottom:8px;" />
          ${p.ban_ve_ky_thuat ? `<img src="${p.ban_ve_ky_thuat}" alt="Bản vẽ" style="height:100px; object-fit:contain; display:block; margin:0 auto; border-top:1px dashed #e2e8f0; padding-top:6px;" />` : ""}
        </div>
      ` },
      { label: "Mã sản phẩm", render: (p) => `<strong style="font-size:1.1rem;">${p.ma_san_pham}</strong>` },
      { label: "Tên sản phẩm", render: (p) => p.ten_san_pham },
      { label: "Giá niêm yết", render: (p) => `<strong style="color:var(--crimson-primary); font-size:1.05rem;">${p.gia_niem_yet}</strong>` },
      { label: "Thương hiệu", render: (p) => `<strong>${p.thuong_hieu}</strong>` },
      { label: "Danh mục", render: (p) => p.danh_muc },
      { label: "Bộ sưu tập", render: (p) => p.bo_suu_tap },
      { label: "Kích thước", render: (p) => `<strong>${p.kich_thuoc}</strong>` },
      { label: "Chất liệu", render: (p) => p.chat_lieu },
      { label: "Bề mặt hoàn thiện", render: (p) => p.be_mat },
      { label: "Chế độ nước", render: (p) => p.che_do_nuoc || "—" },
      { label: "Thông số chi tiết", render: (p) => `<ul style="padding-left:16px; font-size:0.8rem;">${(p.thong_so_ky_thuat || []).map((s) => `<li>${s}</li>`).join("")}</ul>` },
      { label: "Trang Catalogue", render: (p) => `Trang PDF ${p.trang_pdf} (Cat ${p.trang_catalogue})` }
    ];

    body.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="matrix-table">
          <thead>
            <tr>
              <th style="width:180px;">Tiêu chí so sánh</th>
              ${prods.map((p) => `<th>${p.ma_san_pham} — ${p.ten_san_pham}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r) => `
              <tr>
                <td style="font-weight:700; background:#faf8f5;">${r.label}</td>
                ${prods.map((p) => `<td>${r.render(p)}</td>`).join("")}
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    modal.classList.add("open");
  }

  function closeCompareModal() {
    const modal = document.getElementById("compareModal");
    if (modal) modal.classList.remove("open");
  }

  // ==========================================================================
  // STATISTICS & DATA EXPORT MODAL (CSV / JSON)
  // ==========================================================================
  function openStatsModal() {
    const modal = document.getElementById("statsModal");
    const body = document.getElementById("statsModalBody");

    const prices = DATA.products.map((p) => p.gia_so).filter((x) => x > 0);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const avgP = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

    body.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px; background:#faf6ed; padding:16px; border-radius:12px; border:1px solid var(--border-gold);">
        <div>
          <h3 style="font-size:1rem; font-weight:800;">Trích xuất dữ liệu chuẩn 100% từ Catalogue TUSLO &amp; LUSHINE 2026</h3>
          <p style="font-size:0.82rem; color:var(--text-secondary);">Tải xuống toàn bộ 203 sản phẩm, 14 danh mục và 11 Combo dưới định dạng Excel CSV (UTF-8) hoặc JSON.</p>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="nav-btn primary" onclick="app.exportCSV()">📥 Xuất File Excel (.CSV)</button>
          <button class="nav-btn" onclick="app.exportJSON()">📦 Xuất File Dữ Liệu (.JSON)</button>
        </div>
      </div>

      <div class="stats-overview-grid">
        <div style="background:var(--bg-elevated); padding:14px; border-radius:10px; border:1px solid var(--border-light);">
          <div style="font-size:0.75rem; color:var(--text-muted);">Tổng số sản phẩm</div>
          <div style="font-size:1.5rem; font-weight:800; color:var(--gold-primary);">${DATA.products.length} SP</div>
        </div>
        <div style="background:var(--bg-elevated); padding:14px; border-radius:10px; border:1px solid var(--border-light);">
          <div style="font-size:0.75rem; color:var(--text-muted);">Giá thấp nhất (A092)</div>
          <div style="font-size:1.25rem; font-weight:800;">${formatVND(minP)}</div>
        </div>
        <div style="background:var(--bg-elevated); padding:14px; border-radius:10px; border:1px solid var(--border-light);">
          <div style="font-size:0.75rem; color:var(--text-muted);">Giá trung bình toàn Catalogue</div>
          <div style="font-size:1.25rem; font-weight:800;">${formatVND(avgP)}</div>
        </div>
        <div style="background:var(--bg-elevated); padding:14px; border-radius:10px; border:1px solid var(--border-light);">
          <div style="font-size:0.75rem; color:var(--text-muted);">Giá cao nhất (E003 Luxury)</div>
          <div style="font-size:1.25rem; font-weight:800; color:var(--crimson-primary);">${formatVND(maxP)}</div>
        </div>
      </div>

      <h4 style="font-size:0.95rem; font-weight:800; margin-bottom:10px;">📋 Bảng Tổng Hợp 14 Danh Mục Sản Phẩm</h4>
      <div style="overflow-x:auto;">
        <table class="matrix-table">
          <thead>
            <tr>
              <th>Danh mục</th>
              <th>Thương hiệu</th>
              <th>Số lượng SP</th>
              <th>Giá thấp nhất</th>
              <th>Giá trung bình</th>
              <th>Giá cao nhất</th>
              <th>Trang PDF</th>
            </tr>
          </thead>
          <tbody>
            ${DATA.categories
              .map(
                (c) => `
              <tr style="cursor:pointer;" onclick="app.closeStatsModal(); app.selectCategory('${c.ten}');">
                <td style="font-weight:700;">${c.icon} ${c.ten}</td>
                <td><strong>${c.thuong_hieu}</strong></td>
                <td><strong>${c.so_luong}</strong> mẫu</td>
                <td>${formatVND(c.gia_thap_nhat)}</td>
                <td>${formatVND(c.gia_trung_binh)}</td>
                <td style="color:var(--crimson-primary); font-weight:700;">${formatVND(c.gia_cao_nhat)}</td>
                <td>Trang ${c.trang_pdf.join(", ")}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    modal.classList.add("open");
  }

  function closeStatsModal() {
    const modal = document.getElementById("statsModal");
    if (modal) modal.classList.remove("open");
  }

  function exportCSV() {
    const headers = [
      "STT",
      "Mã Sản Phẩm",
      "Tên Sản Phẩm",
      "Thương Hiệu",
      "Danh Mục",
      "Phân Loại",
      "Bộ Sưu Tập",
      "Giá Niêm Yết (VNĐ)",
      "Giá Số",
      "Kích Thước",
      "Chất Liệu",
      "Bề Mặt",
      "Chế Độ Nước",
      "Thông Số Kỹ Thuật",
      "Nhãn Nổi Bật",
      "Trang PDF",
      "Trang Catalogue"
    ];

    const escapeCSV = (val) => {
      const s = val == null ? "" : String(val);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const rows = DATA.products.map((p) =>
      [
        p.stt,
        p.ma_san_pham,
        p.ten_san_pham,
        p.thuong_hieu,
        p.danh_muc,
        p.loai_phu,
        p.bo_suu_tap,
        p.gia_niem_yet,
        p.gia_so,
        p.kich_thuoc,
        p.chat_lieu,
        p.be_mat,
        p.che_do_nuoc || "",
        (p.thong_so_ky_thuat || []).join(" | "),
        (p.badges || []).join(", "),
        p.trang_pdf,
        p.trang_catalogue
      ]
        .map(escapeCSV)
        .join(",")
    );

    const csvContent = "\uFEFF" + [headers.map(escapeCSV).join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Catalogue_Tuslo_Lushine_2026_203_SanPham.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const jsonStr = JSON.stringify(DATA, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Catalogue_Tuslo_Lushine_2026_FullData.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ==========================================================================
  // QUOTATION / BOQ BUILDER (BẢNG BÁO GIÁ & DỰ TOÁN CÔNG TRÌNH)
  // ==========================================================================
  function getQuoteEntries() {
    return Object.entries(state.quoteItems)
      .map(([id, qty]) => {
        const p = DATA.products.find((x) => x.id === id);
        if (!p || qty <= 0) return null;
        return { product: p, qty: Number(qty), lineTotal: p.gia_so * Number(qty) };
      })
      .filter(Boolean);
  }

  function updateQuoteBadge() {
    const entries = getQuoteEntries();
    const totalQty = entries.reduce((sum, e) => sum + e.qty, 0);
    const totalVal = entries.reduce((sum, e) => sum + e.lineTotal, 0);

    const headerBadge = document.getElementById("headerQuoteBadge");
    if (headerBadge) headerBadge.textContent = totalQty;

    const fabSummary = document.getElementById("quoteFabSummary");
    if (fabSummary) {
      fabSummary.textContent =
        totalQty > 0 ? `${totalQty} món • ${(totalVal / 1000000).toFixed(1)}Tr` : "0 món";
    }
  }

  function addToQuote(productId, delta = 1) {
    const current = Number(state.quoteItems[productId] || 0);
    const next = current + Number(delta);
    if (next <= 0) {
      delete state.quoteItems[productId];
    } else {
      state.quoteItems[productId] = next;
    }
    saveQuoteToStorage();
    updateQuoteBadge();
    renderFilteredProducts();
  }

  function addComboToQuote(maCombo) {
    const cb = DATA.combos.find((x) => x.ma_combo === maCombo);
    if (!cb) return;
    (cb.san_pham || []).forEach((it) => {
      const prodObj = DATA.products.find((p) => p.ma_san_pham === it.ma_san_pham);
      if (prodObj) {
        state.quoteItems[prodObj.id] = (state.quoteItems[prodObj.id] || 0) + 1;
      }
    });
    if (!state.quoteMeta.projectName) {
      state.quoteMeta.projectName = `Trọn bộ ${cb.ten_combo} (${cb.phan_khuc} Series)`;
    }
    saveQuoteToStorage();
    updateQuoteBadge();
    renderFilteredProducts();
    if (document.getElementById("quoteModal")?.classList.contains("open")) {
      openQuoteModal();
    }
  }

  function setQuoteQty(productId, qtyVal) {
    const q = parseInt(qtyVal, 10);
    if (isNaN(q) || q <= 0) {
      delete state.quoteItems[productId];
    } else {
      state.quoteItems[productId] = q;
    }
    saveQuoteToStorage();
    updateQuoteBadge();
    renderFilteredProducts();
    openQuoteModal();
  }

  function removeQuoteItem(productId) {
    delete state.quoteItems[productId];
    saveQuoteToStorage();
    updateQuoteBadge();
    renderFilteredProducts();
    openQuoteModal();
  }

  function clearQuote() {
    state.quoteItems = {};
    saveQuoteToStorage();
    updateQuoteBadge();
    renderFilteredProducts();
    openQuoteModal();
  }

  function updateQuoteMetaField(field, val) {
    if (field === "discountPct") {
      state.quoteMeta.discountPct = Math.max(0, Math.min(90, parseFloat(val) || 0));
    } else {
      state.quoteMeta[field] = val;
    }
    saveQuoteToStorage();
    if (field === "discountPct") {
      openQuoteModal();
    }
  }

  function openQuoteModal() {
    const modal = document.getElementById("quoteModal");
    const body = document.getElementById("quoteModalBody");
    if (!modal || !body) return;

    const entries = getQuoteEntries();
    const totalQty = entries.reduce((sum, e) => sum + e.qty, 0);
    const subTotal = entries.reduce((sum, e) => sum + e.lineTotal, 0);
    const discountPct = Number(state.quoteMeta.discountPct || 0);
    const discountAmt = Math.round((subTotal * discountPct) / 100);
    const grandTotal = subTotal - discountAmt;

    const comboOptions = DATA.combos
      .map(
        (c) =>
          `<option value="${c.ma_combo}">+ Thêm nhanh Combo ${c.ma_combo} (${c.so_luong_san_pham} món — ${c.tong_gia_tri_fmt})</option>`
      )
      .join("");

    const rowsHTML =
      entries.length === 0
        ? `
        <tr>
          <td colspan="8" style="text-align:center; padding:38px 16px; color:var(--text-muted);">
            <div style="font-size:2rem; margin-bottom:8px;">🧾</div>
            <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">Chưa có sản phẩm nào trong Bảng Báo Giá</div>
            <div>Hãy nhấn nút <strong>"+ Báo giá"</strong> trên bất kỳ thẻ sản phẩm nào hoặc chọn nhanh 1 trong 11 Combo nhà tắm ở thanh bên trên.</div>
          </td>
        </tr>
      `
        : entries
            .map(
              ({ product: p, qty, lineTotal }, idx) => `
          <tr>
            <td style="font-weight:700; color:var(--text-muted);">${idx + 1}</td>
            <td style="width:60px;">
              <img src="${p.hinh_anh}" alt="${p.ma_san_pham}" style="width:48px; height:48px; object-fit:contain; background:#fff; border:1px solid var(--border-light); border-radius:6px; padding:2px; cursor:pointer;" onclick="app.closeQuoteModal(); app.openProductModal('${p.id}')" />
            </td>
            <td>
              <div style="font-weight:800; color:var(--text-primary); cursor:pointer;" onclick="app.closeQuoteModal(); app.openProductModal('${p.id}')">${p.ma_san_pham}</div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">${p.ten_san_pham} (${p.thuong_hieu})</div>
            </td>
            <td style="font-size:0.78rem; color:var(--text-secondary);">
              <div><strong>KT:</strong> ${p.kich_thuoc}</div>
              <div><strong>CL:</strong> ${p.chat_lieu}</div>
            </td>
            <td style="font-weight:700;">${p.gia_niem_yet}</td>
            <td>
              <div class="quote-qty-ctrl">
                <button onclick="app.setQuoteQty('${p.id}', ${qty - 1})">−</button>
                <input type="number" min="1" value="${qty}" onchange="app.setQuoteQty('${p.id}', this.value)" />
                <button onclick="app.setQuoteQty('${p.id}', ${qty + 1})">+</button>
              </div>
            </td>
            <td style="font-weight:800; color:var(--crimson-primary);">${formatVND(lineTotal)}</td>
            <td>
              <button class="icon-btn" onclick="app.removeQuoteItem('${p.id}')" title="Xóa khỏi báo giá">✕</button>
            </td>
          </tr>
        `
            )
            .join("");

    body.innerHTML = `
      <div class="quote-form-grid">
        <div class="quote-field">
          <label>Khách hàng / Đơn vị</label>
          <input type="text" placeholder="Nhập tên khách hàng hoặc công ty..." value="${state.quoteMeta.customerName || ""}" oninput="app.updateQuoteMetaField('customerName', this.value)" />
        </div>
        <div class="quote-field">
          <label>Số điện thoại / Liên hệ</label>
          <input type="text" placeholder="Ví dụ: 0909 xxx xxx" value="${state.quoteMeta.customerPhone || ""}" oninput="app.updateQuoteMetaField('customerPhone', this.value)" />
        </div>
        <div class="quote-field">
          <label>Tên dự án / Công trình</label>
          <input type="text" placeholder="Ví dụ: Biệt thự Quận 2 / Căn hộ 3PN..." value="${state.quoteMeta.projectName || ""}" oninput="app.updateQuoteMetaField('projectName', this.value)" />
        </div>
        <div class="quote-field">
          <label>Chiết khấu dự kiến (%)</label>
          <input type="number" min="0" max="90" step="0.5" value="${discountPct}" onchange="app.updateQuoteMetaField('discountPct', this.value)" />
        </div>
        <div class="quote-field">
          <label>Thêm nhanh trọn bộ Combo</label>
          <select onchange="if(this.value){ app.addComboToQuote(this.value); this.value=''; }">
            <option value="">-- Chọn Combo nhà tắm để thêm --</option>
            ${comboOptions}
          </select>
        </div>
      </div>

      <div style="overflow-x:auto; max-height:420px; border:1px solid var(--border-light); border-radius:12px;">
        <table class="matrix-table">
          <thead>
            <tr>
              <th style="width:42px;">STT</th>
              <th>Ảnh</th>
              <th>Mã &amp; Tên sản phẩm</th>
              <th>Kích thước &amp; Chất liệu</th>
              <th>Đơn giá niêm yết</th>
              <th style="width:120px;">Số lượng</th>
              <th>Thành tiền</th>
              <th style="width:50px;"></th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </div>

      <div class="quote-summary-card">
        <div>
          <div style="font-size:0.84rem; color:var(--text-secondary);">
            Tổng số mã thiết bị: <strong>${entries.length} mã</strong> (${totalQty} sản phẩm)
          </div>
          <div style="font-size:0.86rem; color:var(--text-secondary); margin-top:3px;">
            Tổng giá niêm yết: <strong>${formatVND(subTotal)}</strong>
            ${discountPct > 0 ? ` • Chiết khấu (${discountPct}%): <strong style="color:#15803d;">-${formatVND(discountAmt)}</strong>` : ""}
          </div>
          <div style="font-size:1.45rem; font-weight:800; color:var(--crimson-primary); margin-top:4px;">
            TỔNG THANH TOÁN DỰ KIẾN: ${formatVND(grandTotal)}
          </div>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          ${
            entries.length > 0
              ? `
            <button class="nav-btn primary" onclick="app.printQuotation()">🖨️ In Báo Giá / Xuất PDF (A4)</button>
            <button class="nav-btn" onclick="app.exportQuoteCSV()">📥 Xuất Báo Giá (.CSV)</button>
            <button class="nav-btn" onclick="app.clearQuote()">🗑️ Xóa tất cả</button>
          `
              : ""
          }
        </div>
      </div>
    `;

    modal.classList.add("open");
  }

  function closeQuoteModal() {
    const modal = document.getElementById("quoteModal");
    if (modal) modal.classList.remove("open");
  }

  function exportQuoteCSV() {
    const entries = getQuoteEntries();
    if (entries.length === 0) return;

    const headers = [
      "STT",
      "Mã Sản Phẩm",
      "Tên Sản Phẩm",
      "Thương Hiệu",
      "Danh Mục",
      "Kích Thước",
      "Chất Liệu",
      "Đơn Giá Niêm Yết (VNĐ)",
      "Số Lượng",
      "Thành Tiền (VNĐ)",
      "Trang PDF"
    ];

    const escapeCSV = (val) => {
      const s = val == null ? "" : String(val);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const rows = entries.map(({ product: p, qty, lineTotal }, idx) =>
      [
        idx + 1,
        p.ma_san_pham,
        p.ten_san_pham,
        p.thuong_hieu,
        p.danh_muc,
        p.kich_thuoc,
        p.chat_lieu,
        p.gia_so,
        qty,
        lineTotal,
        p.trang_pdf
      ]
        .map(escapeCSV)
        .join(",")
    );

    const subTotal = entries.reduce((s, e) => s + e.lineTotal, 0);
    const discountPct = Number(state.quoteMeta.discountPct || 0);
    const discountAmt = Math.round((subTotal * discountPct) / 100);
    const grandTotal = subTotal - discountAmt;

    rows.push(["", "", "", "", "", "", "", "TỔNG CỘNG NIÊM YẾT", "", subTotal, ""].map(escapeCSV).join(","));
    if (discountPct > 0) {
      rows.push(["", "", "", "", "", "", "", `CHIẾT KHẤU (${discountPct}%)`, "", -discountAmt, ""].map(escapeCSV).join(","));
      rows.push(["", "", "", "", "", "", "", "TỔNG THANH TOÁN", "", grandTotal, ""].map(escapeCSV).join(","));
    }

    const csvContent = "\uFEFF" + [headers.map(escapeCSV).join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Bang_Bao_Gia_Tuslo_Lushine_2026.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function printQuotation() {
    const entries = getQuoteEntries();
    if (entries.length === 0) return;

    const subTotal = entries.reduce((s, e) => s + e.lineTotal, 0);
    const discountPct = Number(state.quoteMeta.discountPct || 0);
    const discountAmt = Math.round((subTotal * discountPct) / 100);
    const grandTotal = subTotal - discountAmt;
    const todayStr = new Date().toLocaleDateString("vi-VN");

    const rowsHTML = entries
      .map(
        ({ product: p, qty, lineTotal }, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td><strong>${p.ma_san_pham}</strong><br/><span style="font-size:11px;color:#555;">Trang PDF ${p.trang_pdf}</span></td>
        <td><strong>${p.ten_san_pham}</strong><br/><span style="font-size:11px;color:#555;">${p.danh_muc} • ${p.thuong_hieu}</span></td>
        <td style="font-size:12px;">KT: ${p.kich_thuoc}<br/>CL: ${p.chat_lieu}</td>
        <td style="text-align:right;">${p.gia_so.toLocaleString("vi-VN")}</td>
        <td style="text-align:center;font-weight:bold;">${qty}</td>
        <td style="text-align:right;font-weight:bold;">${lineTotal.toLocaleString("vi-VN")}</td>
      </tr>
    `
      )
      .join("");

    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8" />
        <title>Bảng Báo Giá Thiết Bị TUSLO & LUSHINE 2026 — HOA SEN HOME</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1a202c; margin: 28px; font-size: 13px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #b88928; padding-bottom: 12px; margin-bottom: 18px; }
          .title { font-size: 20px; font-weight: bold; color: #9b1c1c; text-transform: uppercase; margin: 12px 0 4px; text-align: center; }
          .meta { margin-bottom: 16px; background: #faf8f5; padding: 12px; border: 1px solid #e2d9c8; border-radius: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; }
          th { background: #141923; color: #fff; font-size: 12px; }
          .totals { margin-top: 16px; text-align: right; font-size: 14px; }
          .sig { display: flex; justify-content: space-around; margin-top: 40px; text-align: center; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom:16px; text-align:right;">
          <button onclick="window.print()" style="padding:8px 16px; background:#9b1c1c; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">🖨️ In / Lưu PDF ngay</button>
        </div>
        <div class="header">
          <div>
            <strong style="font-size:15px;">CÔNG TY CỔ PHẦN HOA SEN HOME</strong><br/>
            <span>Thương hiệu Thiết bị Nhà tắm TUSLO &amp; Thiết bị Nhà bếp LUSHINE (Catalogue 2026)</span><br/>
            <span>Số 72 Nguyễn Cơ Thạch, Phường An Khánh, TP. Hồ Chí Minh • ĐT: 028 3999 0111 • Tổng đài: 1800 1515 • www.hoasenhome.vn</span>
          </div>
          <div style="text-align:right;">
            <strong>Ngày lập:</strong> ${todayStr}<br/>
            <strong>Catalogue:</strong> 06/2026
          </div>
        </div>

        <div class="title">BẢNG BÁO GIÁ &amp; DỰ TOÁN THIẾT BỊ TUSLO &amp; LUSHINE 2026</div>

        <div class="meta">
          <div><strong>Khách hàng / Đơn vị:</strong> ${state.quoteMeta.customerName || "Quý khách hàng"} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Điện thoại:</strong> ${state.quoteMeta.customerPhone || "—"}</div>
          <div style="margin-top:4px;"><strong>Dự án / Công trình:</strong> ${state.quoteMeta.projectName || "Dự toán thiết bị phòng tắm & nhà bếp"}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:36px;">STT</th>
              <th style="width:110px;">Mã SP</th>
              <th>Tên sản phẩm &amp; Danh mục</th>
              <th>Thông số cơ bản</th>
              <th style="width:110px;">Đơn giá (VNĐ)</th>
              <th style="width:55px;">SL</th>
              <th style="width:125px;">Thành tiền (VNĐ)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>

        <div class="totals">
          <div>Tổng cộng giá niêm yết: <strong>${formatVND(subTotal)}</strong></div>
          ${discountPct > 0 ? `<div>Chiết khấu dự kiến (${discountPct}%): <strong>-${formatVND(discountAmt)}</strong></div>` : ""}
          <div style="font-size:16px; color:#9b1c1c; margin-top:6px;"><strong>TỔNG THANH TOÁN: ${formatVND(grandTotal)}</strong></div>
        </div>

        <div class="sig">
          <div><strong>ĐẠI DIỆN KHÁCH HÀNG</strong><br/><span style="font-size:11px;color:#666;">(Ký &amp; ghi rõ họ tên)</span></div>
          <div><strong>TƯ VẤN VIÊN HOA SEN HOME</strong><br/><span style="font-size:11px;color:#666;">(Ký &amp; ghi rõ họ tên)</span></div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
  }

  // ==========================================================================
  // SMART ROOM CONFIGURATOR & BUDGET PACKAGE BUILDER
  // ==========================================================================
  const CONFIG_SLOTS = [
    { key: "toilet", label: "1. Bồn cầu (1 khối / Thông minh)", categories: ["Bồn cầu 1 khối", "Bồn cầu thông minh"] },
    { key: "basin", label: "2. Tủ chậu Lavabo / Chậu Lavabo", categories: ["Tủ chậu lavabo", "Lavabo"] },
    { key: "faucet", label: "3. Vòi Lavabo (Cơ / Cảm ứng)", categories: ["Vòi lavabo", "Vòi cảm ứng"] },
    { key: "shower", label: "4. Sen tắm / Sen cây nóng lạnh", categories: ["Sen tắm"] },
    { key: "mirror", label: "5. Gương phòng tắm / Gương LED", categories: ["Gương"] },
    { key: "bathtub", label: "6. Bồn tắm / Buồng tắm đứng (Tùy chọn)", categories: ["Bồn tắm"] },
    { key: "urinal", label: "7. Bồn tiểu nam (Tùy chọn)", categories: ["Bồn tiểu nam"] },
    { key: "accessory", label: "8. Phụ kiện phòng tắm tiêu biểu", categories: ["Phụ kiện nhà tắm", "Phụ kiện khác"] },
    { key: "sink", label: "9. Chậu rửa chén LUSHINE (Gian bếp)", categories: ["Chậu rửa chén"] },
    { key: "kitchen_faucet", label: "10. Vòi rửa chén LUSHINE (Gian bếp)", categories: ["Vòi bếp"] }
  ];

  const CONFIG_PRESETS = {
    "eco-bath": {
      name: "🏠 Phòng tắm Căn hộ Tiêu chuẩn (TUSLO Eco ~7.5 Triệu)",
      codes: { toilet: "T005", basin: "L003", faucet: "F017", shower: "S012", mirror: "M002", bathtub: "", urinal: "", accessory: "A030", sink: "", kitchen_faucet: "" }
    },
    "plus-bath": {
      name: "✨ Phòng tắm Gia đình Hiện đại (TUSLO Plus ~13.9 Triệu)",
      codes: { toilet: "T019 Pro", basin: "L036 Pro", faucet: "F016", shower: "S001 Luxury", mirror: "M004", bathtub: "", urinal: "", accessory: "A028", sink: "", kitchen_faucet: "" }
    },
    "master-luxury": {
      name: "💎 Phòng tắm Master Luxury (TUSLO Luxury ~62.7 Triệu)",
      codes: { toilet: "E004 Luxury", basin: "C007 Luxury", faucet: "F004 Luxury", shower: "S003 Luxury", mirror: "M006", bathtub: "B001 Luxury", urinal: "U002 Luxury", accessory: "A032", sink: "", kitchen_faucet: "" }
    },
    "villa-signature": {
      name: "👑 Biệt thự / Penthouse Flagship (2026 Collection ~162.8 Triệu)",
      codes: { toilet: "E003 Luxury", basin: "C013 Luxury", faucet: "F024 Luxury", shower: "S018 Luxury", mirror: "", bathtub: "B005 Luxury", urinal: "U001 Luxury", accessory: "A033", sink: "", kitchen_faucet: "" }
    },
    "kitchen-std": {
      name: "🍽️ Trọn bộ Khu rửa Gian bếp Tiện nghi LUSHINE (~6.3 Triệu)",
      codes: { toilet: "", basin: "", faucet: "", shower: "", mirror: "", bathtub: "", urinal: "", accessory: "", sink: "D001", kitchen_faucet: "K001 Luxury" }
    },
    "kitchen-flagship": {
      name: "🍽️ Gian bếp Thông minh Sóng Siêu Âm UV LUSHINE (~51.1 Triệu)",
      codes: { toilet: "", basin: "", faucet: "", shower: "", mirror: "", bathtub: "", urinal: "", accessory: "", sink: "D012", kitchen_faucet: "K013" }
    }
  };

  let activeConfigSelections = {};

  function ensureDefaultConfig() {
    if (Object.keys(activeConfigSelections).length === 0) {
      applyConfigPreset("plus-bath", false);
    }
  }

  function applyConfigPreset(presetKey, rerender = true) {
    const preset = CONFIG_PRESETS[presetKey];
    if (!preset) return;
    activeConfigSelections = {};
    Object.entries(preset.codes).forEach(([slotKey, code]) => {
      if (!code) {
        activeConfigSelections[slotKey] = "";
        return;
      }
      const p = DATA.products.find((prod) => prod.ma_san_pham === code || prod.ma_goc === code);
      activeConfigSelections[slotKey] = p ? p.id : "";
    });
    if (rerender) renderConfiguratorModalBody();
  }

  function updateConfigSlot(slotKey, prodId) {
    activeConfigSelections[slotKey] = prodId || "";
    renderConfiguratorModalBody();
  }

  function addConfiguredSetToQuote() {
    let added = 0;
    Object.values(activeConfigSelections).forEach((pid) => {
      if (pid) {
        state.quoteItems[pid] = (state.quoteItems[pid] || 0) + 1;
        added++;
      }
    });
    if (added > 0) {
      saveQuoteToStorage();
      updateQuoteBadge();
      renderFilteredProducts();
      closeConfiguratorModal();
      openQuoteModal();
    }
  }

  function renderConfiguratorModalBody() {
    const body = document.getElementById("configuratorModalBody");
    if (!body) return;

    let totalBudget = 0;
    let selectedProducts = [];

    const slotsHTML = CONFIG_SLOTS.map((slot) => {
      const optionsProds = DATA.products.filter((p) => slot.categories.includes(p.danh_muc));
      const selectedId = activeConfigSelections[slot.key] || "";
      const selProd = DATA.products.find((p) => p.id === selectedId);
      if (selProd) {
        totalBudget += selProd.gia_so;
        selectedProducts.push({ slotLabel: slot.label, prod: selProd });
      }

      const optsHTML = optionsProds
        .map(
          (p) =>
            `<option value="${p.id}" ${p.id === selectedId ? "selected" : ""}>${p.ma_san_pham} — ${p.ten_san_pham} (${p.gia_niem_yet})</option>`
        )
        .join("");

      return `
        <div style="background:#fff; border:1px solid ${selProd ? "var(--gold-primary)" : "var(--border-light)"}; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:0.78rem; font-weight:800; color:var(--text-primary);">${slot.label}</div>
          <select class="filter-select" onchange="app.updateConfigSlot('${slot.key}', this.value)">
            <option value="">-- Không chọn hạng mục này --</option>
            ${optsHTML}
          </select>
          ${
            selProd
              ? `
            <div style="display:flex; align-items:center; gap:10px; background:var(--bg-elevated); padding:8px; border-radius:8px; margin-top:2px;">
              <img src="${selProd.hinh_anh}" alt="${selProd.ma_san_pham}" style="width:48px; height:48px; object-fit:contain; background:#fff; border-radius:6px; border:1px solid var(--border-light); cursor:pointer;" onclick="app.closeConfiguratorModal(); app.openProductModal('${selProd.id}');" />
              <div style="min-width:0; flex:1;">
                <div style="font-weight:800; font-size:0.84rem; color:var(--text-primary); cursor:pointer;" onclick="app.closeConfiguratorModal(); app.openProductModal('${selProd.id}');">${selProd.ma_san_pham}</div>
                <div style="font-size:0.72rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">KT: ${selProd.kich_thuoc}</div>
                <div style="font-size:0.82rem; font-weight:800; color:var(--crimson-primary);">${selProd.gia_niem_yet}</div>
              </div>
            </div>
          `
              : `<div style="font-size:0.74rem; color:var(--text-muted); padding:6px 0;">Chưa chọn thiết bị cho hạng mục này</div>`
          }
        </div>
      `;
    }).join("");

    const presetBtnsHTML = Object.entries(CONFIG_PRESETS)
      .map(
        ([k, pr]) =>
          `<button class="nav-btn" onclick="app.applyConfigPreset('${k}')">${pr.name}</button>`
      )
      .join("");

    body.innerHTML = `
      <div style="background:var(--bg-elevated); border:1px solid var(--border-gold); border-radius:12px; padding:14px; margin-bottom:16px;">
        <div style="font-size:0.8rem; font-weight:800; color:#7d5a10; text-transform:uppercase; margin-bottom:8px;">
          ⚡ CHỌN NHANH CẤU HÌNH MẪU THEO PHÂN KHÚC &amp; NGÂN SÁCH:
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${presetBtnsHTML}
        </div>
      </div>

      <div class="configurator-slots-grid">
        ${slotsHTML}
      </div>

      <div class="quote-summary-card">
        <div>
          <div style="font-size:0.84rem; color:var(--text-secondary);">
            Số hạng mục đã chọn: <strong>${selectedProducts.length} / ${CONFIG_SLOTS.length} hạng mục</strong>
          </div>
          <div style="font-size:1.45rem; font-weight:800; color:var(--crimson-primary); margin-top:4px;">
            TỔNG NGÂN SÁCH BỘ THIẾT BỊ: ${formatVND(totalBudget)}
          </div>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="nav-btn primary" onclick="app.addConfiguredSetToQuote()">
            🧾 Đưa Toàn Bộ (${selectedProducts.length} Món) Vào Bảng Báo Giá
          </button>
        </div>
      </div>
    `;
  }

  function openConfiguratorModal() {
    ensureDefaultConfig();
    renderConfiguratorModalBody();
    const modal = document.getElementById("configuratorModal");
    if (modal) modal.classList.add("open");
  }

  function closeConfiguratorModal() {
    const modal = document.getElementById("configuratorModal");
    if (modal) modal.classList.remove("open");
  }

  // ==========================================================================
  // INSTANT SEARCH SUGGESTIONS
  // ==========================================================================
  const SEARCH_PILLS = [
    { label: "🔥 T005 Bán chạy", q: "T005" },
    { label: "✨ E003 Thông minh", q: "E003" },
    { label: "🏆 C013 2026 Col", q: "C013" },
    { label: "🍽️ D012 Sóng siêu âm", q: "D012" },
    { label: "🚿 S018 Sen LED", q: "S018" },
    { label: "💎 F024 Vòi cảm ứng", q: "F024" },
    { label: "🛁 B005 Corian", q: "B005" },
    { label: "🛋️ 11 Combo", q: "Combo" },
    { label: "Inox Nano Linen", q: "Nano Linen" }
  ];

  function renderSearchSuggestions(query) {
    const dropdown = document.getElementById("searchSuggestionsDropdown");
    if (!dropdown) return;

    const trimmed = (query || "").trim();

    if (!trimmed) {
      const pillsHTML = SEARCH_PILLS.map(
        (p) => `<button class="sugg-pill" onclick="app.quickSearch('${p.q}')">${p.label}</button>`
      ).join("");

      const flagshipCodes = ["T005", "E003 Luxury", "C013 Luxury", "D012", "S018 Luxury"];
      const flagships = DATA.products.filter((p) => flagshipCodes.includes(p.ma_san_pham)).slice(0, 4);
      const prodsHTML = flagships.map(renderSuggestionItemHTML).join("");

      dropdown.innerHTML = `
        <div class="sugg-header">TỪ KHÓA TÌM KIẾM NỔI BẬT:</div>
        <div class="sugg-pills-wrap">${pillsHTML}</div>
        <div class="sugg-header">SẢN PHẨM TIÊU BIỂU CATALOGUE 2026:</div>
        <div>${prodsHTML}</div>
      `;
      dropdown.classList.add("open");
      return;
    }

    const normQ = normalizeVN(trimmed);
    const matches = DATA.products.filter((p) => p._searchIndex.includes(normQ));

    if (matches.length === 0) {
      dropdown.innerHTML = `
        <div style="padding:14px; text-align:center; color:var(--text-muted); font-size:0.82rem;">
          Không tìm thấy sản phẩm nào khớp với "<strong>${trimmed}</strong>".<br/>
          Thử tìm theo mã: <strong>T005</strong>, <strong>E003</strong>, <strong>C013</strong>, <strong>D012</strong>, <strong>S018</strong>...
        </div>
      `;
      dropdown.classList.add("open");
      return;
    }

    const topMatches = matches.slice(0, 6);
    const itemsHTML = topMatches.map(renderSuggestionItemHTML).join("");

    dropdown.innerHTML = `
      <div class="sugg-header">GỢI Ý TÌM KIẾM (${matches.length} KẾT QUẢ):</div>
      <div>${itemsHTML}</div>
      <div class="sugg-footer">
        <button class="sugg-view-all-btn" onclick="app.closeSearchSuggestions(); app.scrollToSection('showroomSection');">
          Xem tất cả ${matches.length} sản phẩm trong Showroom ➜
        </button>
      </div>
    `;
    dropdown.classList.add("open");
  }

  function renderSuggestionItemHTML(p) {
    return `
      <div class="sugg-item" onclick="app.closeSearchSuggestions(); app.openProductModal('${p.id}');">
        <img src="${p.hinh_anh}" alt="${p.ma_san_pham}" loading="lazy" />
        <div style="min-width:0; flex:1;">
          <div class="sugg-item-code">${p.ma_san_pham} <span style="font-size:0.72rem; color:var(--gold-primary); font-weight:600;">[${p.thuong_hieu}]</span></div>
          <div class="sugg-item-name">${p.ten_san_pham} — ${p.danh_muc}</div>
        </div>
        <div class="sugg-item-price">${p.gia_niem_yet}</div>
      </div>
    `;
  }

  function closeSearchSuggestions() {
    const dropdown = document.getElementById("searchSuggestionsDropdown");
    if (dropdown) dropdown.classList.remove("open");
  }

  function quickSearch(kw) {
    const searchInput = document.getElementById("globalSearchInput");
    const clearBtn = document.getElementById("searchClearBtn");
    if (searchInput) searchInput.value = kw;
    if (clearBtn) clearBtn.style.display = "flex";
    state.searchQuery = kw;
    closeSearchSuggestions();
    renderFilteredProducts();
    app.scrollToSection("showroomSection");
  }

  // ==========================================================================
  // AR 3D EXPERIENCE & ROOM SIMULATOR
  // ==========================================================================
  const AR_ROOMS = [
    { key: "master_bath", label: "🛁 Phòng tắm Master", bg: "assets/pages/page_05.jpg" },
    { key: "spa_bath", label: "✨ Thư giãn Spa", bg: "assets/pages/page_07.jpg" },
    { key: "kitchen_lux", label: "🍽️ Gian bếp LUSHINE", bg: "assets/pages/page_08.jpg" },
    { key: "compact_bath", label: "🚿 Phòng tắm Tinh giản", bg: "assets/pages/page_48.jpg" }
  ];

  let currentARState = {
    productId: null,
    roomKey: "master_bath",
    scale: 1,
    flipped: false
  };

  function openARModal(productId) {
    const p = DATA.products.find((x) => x.id === productId);
    if (!p) return;

    currentARState.productId = productId;
    currentARState.scale = 1;
    currentARState.flipped = false;
    currentARState.roomKey = p.thuong_hieu === "LUSHINE" ? "kitchen_lux" : "master_bath";

    renderARModalContent(p);

    const modal = document.getElementById("arModal");
    if (modal) modal.classList.add("open");
  }

  function closeARModal() {
    const modal = document.getElementById("arModal");
    if (modal) modal.classList.remove("open");
  }

  function switchARRoom(roomKey) {
    currentARState.roomKey = roomKey;
    const p = DATA.products.find((x) => x.id === currentARState.productId);
    if (p) renderARModalContent(p);
  }

  function setARScale(scale) {
    currentARState.scale = scale;
    updateARProductTransform();
    document.querySelectorAll(".ar-scale-btn").forEach((b) => {
      b.classList.toggle("active", parseFloat(b.getAttribute("data-scale")) === scale);
    });
  }

  function toggleARFlip() {
    currentARState.flipped = !currentARState.flipped;
    updateARProductTransform();
  }

  function updateARProductTransform() {
    const view = document.getElementById("arProductView");
    if (!view) return;
    const flipStr = currentARState.flipped ? "scaleX(-1)" : "scaleX(1)";
    const scaleStr = `scale(${currentARState.scale})`;
    view.style.transform = `${scaleStr} ${flipStr}`;
  }

  function renderARModalContent(p) {
    const body = document.getElementById("arModalBody");
    const title = document.getElementById("arModalTitle");
    if (!body) return;

    if (title) {
      title.innerHTML = `<span>📱 Trải Nghiệm Thực Tế Ảo (AR 3D) — ${p.ma_san_pham} (${p.thuong_hieu})</span>`;
    }

    const currentRoom = AR_ROOMS.find((r) => r.key === currentARState.roomKey) || AR_ROOMS[0];

    const roomTabsHTML = AR_ROOMS.map(
      (r) => `
      <button class="ar-room-tab ${r.key === currentARState.roomKey ? "active" : ""}" onclick="app.switchARRoom('${r.key}')">
        ${r.label}
      </button>
    `
    ).join("");

    const flipStr = currentARState.flipped ? "scaleX(-1)" : "scaleX(1)";
    const scaleStr = `scale(${currentARState.scale})`;

    const qrSvg = `
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="white"/>
        <rect x="10" y="10" width="24" height="24" stroke="#1a202c" stroke-width="4"/>
        <rect x="16" y="16" width="12" height="12" fill="#9b1c1c"/>
        <rect x="66" y="10" width="24" height="24" stroke="#1a202c" stroke-width="4"/>
        <rect x="72" y="16" width="12" height="12" fill="#9b1c1c"/>
        <rect x="10" y="66" width="24" height="24" stroke="#1a202c" stroke-width="4"/>
        <rect x="16" y="72" width="12" height="12" fill="#9b1c1c"/>
        <rect x="42" y="12" width="6" height="6" fill="#1a202c"/>
        <rect x="52" y="12" width="6" height="6" fill="#b88928"/>
        <rect x="42" y="24" width="6" height="6" fill="#1a202c"/>
        <rect x="48" y="32" width="6" height="6" fill="#1a202c"/>
        <rect x="14" y="44" width="6" height="6" fill="#b88928"/>
        <rect x="24" y="44" width="6" height="6" fill="#1a202c"/>
        <rect x="36" y="44" width="6" height="6" fill="#1a202c"/>
        <rect x="46" y="44" width="8" height="8" fill="#9b1c1c"/>
        <rect x="58" y="44" width="6" height="6" fill="#1a202c"/>
        <rect x="72" y="44" width="6" height="6" fill="#b88928"/>
        <rect x="82" y="44" width="6" height="6" fill="#1a202c"/>
        <rect x="42" y="56" width="6" height="6" fill="#1a202c"/>
        <rect x="54" y="56" width="6" height="6" fill="#b88928"/>
        <rect x="42" y="68" width="6" height="6" fill="#1a202c"/>
        <rect x="52" y="68" width="6" height="6" fill="#1a202c"/>
        <rect x="42" y="80" width="6" height="6" fill="#b88928"/>
        <rect x="68" y="72" width="6" height="6" fill="#1a202c"/>
        <rect x="80" y="72" width="6" height="6" fill="#1a202c"/>
        <rect x="74" y="82" width="6" height="6" fill="#1a202c"/>
      </svg>
    `;

    body.innerHTML = `
      <div class="ar-modal-grid">
        <div class="ar-stage-card">
          <div class="ar-room-selector">
            <span style="font-size:0.73rem; font-weight:800; color:var(--gold-light); align-self:center; margin-right:4px;">PHÒNG MẪU:</span>
            ${roomTabsHTML}
          </div>

          <div class="ar-stage-viewport" id="arStageViewport" style="background-image: url('${currentRoom.bg}');">
            <div class="ar-stage-overlay"></div>
            <div class="ar-product-view" id="arProductView" style="transform: ${scaleStr} ${flipStr};">
              <img src="${p.hinh_anh}" alt="${p.ma_san_pham}" />
            </div>
          </div>

          <div class="ar-stage-controls">
            <div class="ar-ctrl-group">
              <span style="color:#cbd5e1;">Tỷ lệ:</span>
              <button class="ar-ctrl-btn ar-scale-btn ${currentARState.scale === 0.8 ? "active" : ""}" data-scale="0.8" onclick="app.setARScale(0.8)">80%</button>
              <button class="ar-ctrl-btn ar-scale-btn ${currentARState.scale === 1 ? "active" : ""}" data-scale="1" onclick="app.setARScale(1)">100% (1:1)</button>
              <button class="ar-ctrl-btn ar-scale-btn ${currentARState.scale === 1.25 ? "active" : ""}" data-scale="1.25" onclick="app.setARScale(1.25)">125%</button>
            </div>
            <div class="ar-ctrl-group">
              <button class="ar-ctrl-btn" onclick="app.toggleARFlip()">🔄 Lật góc nhìn</button>
              <button class="ar-ctrl-btn" onclick="app.setARScale(1)">🎯 Đặt lại</button>
            </div>
          </div>
        </div>

        <div class="ar-qr-panel">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <span class="p-badge luxury">${p.thuong_hieu}</span>
              <span class="p-badge col2026">${p.bo_suu_tap}</span>
              <span class="p-badge ar">AR 3D WEBXR</span>
            </div>
            <h3 style="font-size:1.35rem; font-weight:800; margin-bottom:4px;">${p.ma_san_pham}</h3>
            <p style="font-size:0.86rem; color:var(--text-secondary); margin-bottom:8px;">${p.ten_san_pham} — ${p.danh_muc}</p>
            <div style="font-size:1.4rem; font-weight:800; color:var(--crimson-primary); margin-bottom:12px;">${p.gia_niem_yet}</div>

            <div style="background:var(--bg-elevated); border-radius:10px; padding:10px 12px; font-size:0.8rem; margin-bottom:14px;">
              <div>• <strong>Kích thước chuẩn:</strong> ${p.kich_thuoc}</div>
              <div style="margin-top:3px;">• <strong>Chất liệu:</strong> ${p.chat_lieu}</div>
              <div style="margin-top:3px;">• <strong>Bề mặt:</strong> ${p.be_mat}</div>
            </div>

            <div class="ar-qr-box">
              <div class="ar-qr-svg-wrap">
                ${qrSvg}
              </div>
              <strong style="color:#7d5a10; font-size:0.82rem; display:block;">QUÉT MÃ QR BẰNG CAMERA ĐIỆN THOẠI</strong>
              <span style="font-size:0.72rem; color:var(--text-secondary); display:block; margin-top:2px;">
                Tương thích iPhone (QuickLook) &amp; Android (Scene Viewer / Google ARCore)
              </span>
            </div>

            <ul class="ar-steps-list">
              <li>
                <span class="ar-step-num">1</span>
                <span>Mở camera trên điện thoại hoặc Zalo, quét mã QR phía trên.</span>
              </li>
              <li>
                <span class="ar-step-num">2</span>
                <span>Hướng camera vào sàn phòng tắm hoặc mặt bàn bếp để nhận diện mặt phẳng.</span>
              </li>
              <li>
                <span class="ar-step-num">3</span>
                <span>Di chuyển, xoay và ướm thử sản phẩm đúng tỷ lệ kích thước thật (1:1).</span>
              </li>
            </ul>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; border-top:1px solid var(--border-light); padding-top:12px;">
            <button class="nav-btn primary" onclick="app.addToQuote('${p.id}', 1); app.openProductModal('${p.id}');">
              🧾 + Thêm vào Báo Giá
            </button>
            <button class="nav-btn" onclick="app.toggleCompare('${p.id}');">
              ${state.compareIds.includes(p.id) ? "✓ Đang so sánh" : "⚖️ So sánh"}
            </button>
            <button class="nav-btn" onclick="app.closeARModal(); app.openProductModal('${p.id}');">
              Chi tiết thông số
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // MOBILE FILTER DRAWER HANDLERS
  // ==========================================================================
  function toggleMobileFilter() {
    const sidebar = document.getElementById("filterSidebar");
    const backdrop = document.getElementById("filterDrawerBackdrop");
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle("open");
    if (backdrop) backdrop.classList.toggle("open", isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";
  }

  function openMobileFilter() {
    const sidebar = document.getElementById("filterSidebar");
    const backdrop = document.getElementById("filterDrawerBackdrop");
    if (sidebar) sidebar.classList.add("open");
    if (backdrop) backdrop.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeMobileFilter() {
    const sidebar = document.getElementById("filterSidebar");
    const backdrop = document.getElementById("filterDrawerBackdrop");
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("open");
    document.body.style.overflow = "";
  }

  // ==========================================================================
  // PUBLIC CONTROLLER API
  // ==========================================================================
  window.app = {
    toggleMobileFilter,
    openMobileFilter,
    closeMobileFilter,
    selectCategory(catName) {
      state.category = catName;
      renderHeaderCategories();
      renderCategoryOverviewCards();
      renderFilteredProducts();
      document.getElementById("showroomSection").scrollIntoView({ behavior: "smooth", block: "start" });
    },

    filterByBrand(brand) {
      state.brand = brand;
      renderCategoryOverviewCards();
      renderSidebarFilters();
      renderFilteredProducts();
    },

    filterByCollection(col) {
      state.collection = col;
      renderSidebarFilters();
      renderFilteredProducts();
    },

    setPricePreset(rangeStr) {
      state.pricePreset = rangeStr;
      document.querySelectorAll(".price-preset-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-range") === rangeStr);
      });
      const slider = document.getElementById("maxPriceSlider");
      const label = document.getElementById("priceSliderLabel");
      if (rangeStr === "all") {
        state.minPrice = 0;
        state.maxPrice = 65000000;
        if (slider) slider.value = 65000000;
        if (label) label.textContent = "Tối đa: 65.000.000 ₫";
      } else {
        const [minS, maxS] = rangeStr.split("-");
        state.minPrice = parseInt(minS, 10);
        state.maxPrice = parseInt(maxS, 10);
        if (slider) slider.value = Math.min(65000000, state.maxPrice);
        if (label) {
          label.textContent = `${state.minPrice.toLocaleString("vi-VN")} – ${
            state.maxPrice > 65000000 ? "63.180.000+" : state.maxPrice.toLocaleString("vi-VN")
          } ₫`;
        }
      }
      renderFilteredProducts();
    },

    onCheckboxFilterChange() {
      state.onlyBestseller = !!document.getElementById("chkBestseller")?.checked;
      state.only2026 = !!document.getElementById("chk2026")?.checked;
      state.onlyDrawing = !!document.getElementById("chkHasDrawing")?.checked;
      state.onlyAR = !!document.getElementById("chkHasAR")?.checked;
      state.onlyInCombo = !!document.getElementById("chkInCombo")?.checked;
      renderFilteredProducts();
    },

    clearCheckbox(id) {
      const el = document.getElementById(id);
      if (el) el.checked = false;
      this.onCheckboxFilterChange();
    },

    onSelectFilterChange() {
      state.waterMode = document.getElementById("filterWaterSelect")?.value || "ALL";
      state.pdfPage = document.getElementById("filterPageSelect")?.value || "ALL";
      renderFilteredProducts();
    },

    clearWaterMode() {
      const el = document.getElementById("filterWaterSelect");
      if (el) el.value = "ALL";
      state.waterMode = "ALL";
      renderFilteredProducts();
    },

    clearPdfPage() {
      const el = document.getElementById("filterPageSelect");
      if (el) el.value = "ALL";
      state.pdfPage = "ALL";
      renderFilteredProducts();
    },

    clearSearch() {
      const input = document.getElementById("globalSearchInput");
      const clearBtn = document.getElementById("searchClearBtn");
      if (input) input.value = "";
      if (clearBtn) clearBtn.style.display = "none";
      state.searchQuery = "";
      renderFilteredProducts();
    },

    applyQuickFilter(qf) {
      this.resetAllFilters(false);
      state.quickFilter = qf;
      document.querySelectorAll("#heroQuickFilters .qf-btn").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-qf") === qf);
      });

      if (qf === "col2026") {
        state.only2026 = true;
        document.getElementById("chk2026").checked = true;
      } else if (qf === "bestseller") {
        state.onlyBestseller = true;
        document.getElementById("chkBestseller").checked = true;
      } else if (qf === "luxury") {
        state.collection = "Luxury";
      } else if (qf === "pro") {
        state.collection = "Pro";
      } else if (qf === "drawing") {
        state.onlyDrawing = true;
        document.getElementById("chkHasDrawing").checked = true;
      } else if (qf === "ar") {
        state.onlyAR = true;
        document.getElementById("chkHasAR").checked = true;
      } else if (qf === "lushine") {
        state.brand = "LUSHINE";
      }

      renderHeaderCategories();
      renderCategoryOverviewCards();
      renderSidebarFilters();
      renderFilteredProducts();
      document.getElementById("showroomSection").scrollIntoView({ behavior: "smooth", block: "start" });
    },

    resetAllFilters(rerender = true) {
      state.searchQuery = "";
      state.category = "ALL";
      state.brand = "ALL";
      state.collection = "ALL";
      state.minPrice = 0;
      state.maxPrice = 65000000;
      state.pricePreset = "all";
      state.onlyBestseller = false;
      state.only2026 = false;
      state.onlyDrawing = false;
      state.onlyAR = false;
      state.onlyInCombo = false;
      state.waterMode = "ALL";
      state.pdfPage = "ALL";
      state.quickFilter = "all";

      const searchInput = document.getElementById("globalSearchInput");
      if (searchInput) searchInput.value = "";
      const clearBtn = document.getElementById("searchClearBtn");
      if (clearBtn) clearBtn.style.display = "none";

      ["chkBestseller", "chk2026", "chkHasDrawing", "chkHasAR", "chkInCombo"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
      });

      const waterSel = document.getElementById("filterWaterSelect");
      if (waterSel) waterSel.value = "ALL";
      const pageSel = document.getElementById("filterPageSelect");
      if (pageSel) pageSel.value = "ALL";

      const slider = document.getElementById("maxPriceSlider");
      if (slider) slider.value = 65000000;
      const label = document.getElementById("priceSliderLabel");
      if (label) label.textContent = "Tối đa: 65.000.000 ₫";

      document.querySelectorAll(".price-preset-btn").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-range") === "all");
      });
      document.querySelectorAll("#heroQuickFilters .qf-btn").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-qf") === "all");
      });

      if (rerender) {
        renderHeaderCategories();
        renderCategoryOverviewCards();
        renderSidebarFilters();
        renderFilteredProducts();
      }
    },

    onSortChange() {
      state.sortBy = document.getElementById("sortSelect")?.value || "catalogue";
      renderFilteredProducts();
    },

    setViewMode(mode) {
      state.viewMode = mode;
      document.getElementById("viewBtnGrid")?.classList.toggle("active", mode === "grid");
      document.getElementById("viewBtnList")?.classList.toggle("active", mode === "list");
      renderFilteredProducts();
    },

    toggleCardDrawing(btnEl, photoSrc, drawSrc) {
      const cardMedia = btnEl.closest(".card-media");
      const img = cardMedia ? cardMedia.querySelector("img") : null;
      if (!img) return;

      const showingDrawing = btnEl.classList.contains("active");
      if (showingDrawing) {
        img.src = photoSrc;
        btnEl.classList.remove("active");
        btnEl.textContent = "📐 Bản vẽ KT";
      } else {
        img.src = drawSrc;
        btnEl.classList.add("active");
        btnEl.textContent = "📷 Ảnh SP";
      }
    },

    filterCombos(tier) {
      state.comboTier = tier;
      document.querySelectorAll("#comboTierFilterBar .nav-btn").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-tier") === tier);
      });
      renderCombosSection();
    },

    filterLookbook(zone) {
      state.lookbookFilter = zone;
      document.querySelectorAll("#lookbookFilterBar .nav-btn").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-lb") === zone);
      });
      renderLookbookSection();
    },

    scrollToSection(sectionId) {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    },

    openPageInExplorer(pno, highlightProdId = null) {
      goToExplorerPage(pno, highlightProdId);
      const sec = document.getElementById("catalogueExplorerSection");
      if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    },

    goToExplorerPage,

    stepExplorerPage(delta) {
      goToExplorerPage(state.explorerPage + delta);
    },

    setExplorerZoom(pct) {
      state.explorerZoom = pct;
      const stage = document.getElementById("explorerSpreadStage");
      if (stage) stage.style.width = pct + "%";
      [100, 135, 175].forEach((z) => {
        document.getElementById("zoomBtn" + z)?.classList.toggle("active", z === pct);
      });
    },

    openProductModal,
    closeProductModal,
    openComboModal,
    closeComboModal,
    toggleComboMore,
    openLightbox,
    closeLightbox,
    switchDetailMedia,
    toggleCompare,
    clearComparison,
    openCompareModal,
    closeCompareModal,
    openStatsModal,
    closeStatsModal,
    openConfiguratorModal,
    closeConfiguratorModal,
    applyConfigPreset,
    updateConfigSlot,
    addConfiguredSetToQuote,
    renderSearchSuggestions,
    closeSearchSuggestions,
    quickSearch,
    openARModal,
    closeARModal,
    switchARRoom,
    setARScale,
    toggleARFlip,
    exportCSV,
    exportJSON,
    addToQuote,
    addComboToQuote,
    setQuoteQty,
    removeQuoteItem,
    clearQuote,
    updateQuoteMetaField,
    openQuoteModal,
    closeQuoteModal,
    exportQuoteCSV,
    printQuotation
  };

  document.addEventListener("DOMContentLoaded", init);
})();

