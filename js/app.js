/**
 * 다이소 장보기 도우미 — 메인 앱 로직
 */
const App = {
  currentScreen: 'main',
  searchPage: 1,
  searchQuery: '',
  searchHasMore: false,
  confirmCallback: null,
  _autocompleteTimer: null,
  _autocompleteLoading: false,
  _autoCheckInProgress: false,
  _autoCheckedIds: new Set(),

  // ===== 초기화 =====

  init() {
    this.bindEvents();
    this._bindDetailEvents();
    this.renderShoppingList();
    this.renderMyStore();
    this._initRipple();
  },

  // ===== 이벤트 바인딩 =====

  bindEvents() {
    // 네비게이션
    $('#btnBack').addEventListener('click', () => this.goBack());
    $('#btnChangeStore').addEventListener('click', () => this.showScreen('store'));

    // 탭바
    $('#tabBar').addEventListener('click', e => {
      const tab = e.target.closest('.tab-item');
      if (!tab) return;
      const screen = tab.dataset.tab;
      if (screen) this.showScreen(screen);
    });

    // 빈 리스트 버튼
    document.addEventListener('click', e => {
      if (e.target.closest('#btnEmptySearch')) this.showScreen('search');
      if (e.target.closest('#btnEmptyAdd')) this.showManualAddModal();
    });

    // 요약바 직접 추가 버튼
    $('#btnSummaryAdd').addEventListener('click', () => this.showManualAddModal());
    $('#btnModalCancel').addEventListener('click', () => this.hideModal());
    $('#btnModalAdd').addEventListener('click', () => this.handleManualAdd());
    $('#modalOverlay').addEventListener('click', e => {
      if (e.target === $('#modalOverlay')) this.hideModal();
    });

    // 확인 다이얼로그
    $('#confirmOverlay').addEventListener('click', e => {
      if (e.target === $('#confirmOverlay')) this.hideConfirm();
    });
    $('#btnConfirmCancel').addEventListener('click', () => this.hideConfirm());
    $('#btnConfirmOk').addEventListener('click', () => {
      if (this.confirmCallback) this.confirmCallback();
      this.hideConfirm();
    });

    // 리스트 관리
    $('#btnClearChecked').addEventListener('click', () => {
      this.showConfirm('체크된 항목을 모두 삭제하시겠습니까?', () => {
        const items = Storage.getShoppingList().filter(i => !i.checked);
        Storage.saveShoppingList(items);
        this.renderShoppingList();
        this.toast('체크된 항목 삭제됨', 'error');
      });
    });
    $('#btnClearAll').addEventListener('click', () => {
      this.showConfirm('장보기 리스트를 모두 초기화하시겠습니까?', () => {
        Storage.clearShoppingList();
        this.renderShoppingList();
        this.toast('리스트가 초기화되었습니다', 'error');
      });
    });

    // 재고 확인
    $('#btnCheckStock').addEventListener('click', () => this.checkAllStock());

    // 제품 검색
    $('#searchInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        this._hideAutocomplete();
        this.handleSearch();
      }
    });
    $('#searchClear').addEventListener('click', () => {
      $('#searchInput').value = '';
      $('#searchClear').style.display = 'none';
      this._hideAutocomplete();
      $('#searchResults').innerHTML = '<div class="search-history" id="searchHistory"></div><div class="search-hint" id="searchHint"><p>검색어를 입력하면 다이소 제품을 찾을 수 있어요</p></div>';
      this._renderSearchHistory();
    });
    $('#searchInput').addEventListener('input', () => {
      const value = $('#searchInput').value;
      $('#searchClear').style.display = value ? 'flex' : 'none';
      this._onSearchInput(value.trim());
    });
    $('#searchInput').addEventListener('focus', () => {
      const value = $('#searchInput').value.trim();
      if (value) {
        this._onSearchInput(value);
      } else {
        this._renderSearchHistory();
      }
    });
    // 자동완성 외부 클릭 시 숨김
    document.addEventListener('mousedown', e => {
      const dropdown = $('#autocompleteDropdown');
      const searchContainer = e.target.closest('.search-container');
      if (!searchContainer && dropdown) {
        this._hideAutocomplete();
      }
    });

    // 매장 검색
    $('#storeSearchInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.handleStoreSearch();
    });
    $('#storeSearchClear').addEventListener('click', () => {
      $('#storeSearchInput').value = '';
      $('#storeSearchClear').style.display = 'none';
      $('#storeResults').innerHTML = '<div class="search-hint" id="storeHint"><p>매장명이나 지역을 검색해주세요</p><p class="empty-sub">예: "강남", "홍대", "수원역"</p></div>';
    });
    $('#storeSearchInput').addEventListener('input', () => {
      $('#storeSearchClear').style.display = $('#storeSearchInput').value ? 'flex' : 'none';
    });

    // 매장 해제
    $('#btnRemoveStore').addEventListener('click', () => {
      Storage.removeMyStore();
      this.renderMyStore();
      this.renderStoreScreen();
      this.toast('매장이 해제되었습니다', 'info');
    });
  },

  // ===== 화면 전환 =====

  showScreen(name) {
    this.currentScreen = name;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    const screenMap = {
      main: 'screenMain',
      search: 'screenSearch',
      store: 'screenStore',
      stock: 'screenStock',
      detail: 'screenDetail'
    };

    const screenEl = $(`#${screenMap[name]}`);
    if (screenEl) screenEl.classList.add('active');

    // 헤더 업데이트
    const titles = {
      main: '장보기 리스트',
      search: '제품 검색',
      store: '매장 설정',
      stock: '재고 확인',
      detail: '제품 상세'
    };
    $('#headerTitle').textContent = titles[name] || '';

    // 뒤로가기는 stock, detail 화면에서 표시
    $('#btnBack').style.display = (name === 'stock' || name === 'detail') ? 'flex' : 'none';

    // 탭바: stock, detail에서 숨김, 나머지는 표시
    const tabBar = $('#tabBar');
    if (name === 'stock' || name === 'detail') {
      tabBar.classList.add('hidden');
    } else {
      tabBar.classList.remove('hidden');
      // 탭바 활성 상태 업데이트
      tabBar.querySelectorAll('.tab-item').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === name);
      });
    }

    // 화면별 초기화
    if (name === 'search') {
      setTimeout(() => $('#searchInput').focus(), 100);
      this._renderSearchHistory();
    } else if (name === 'store') {
      this.renderStoreScreen();
      setTimeout(() => $('#storeSearchInput').focus(), 100);
    } else if (name === 'main') {
      this.renderShoppingList();
    }
  },

  goBack() {
    this.showScreen('main');
    this.renderShoppingList();
  },

  // ===== 장보기 리스트 렌더링 =====

  renderShoppingList() {
    const items = Storage.getShoppingList();
    const listEl = $('#itemList');
    const emptyEl = $('#emptyState');
    const summaryBar = $('#summaryBar');
    const listActions = $('#listActions');

    if (items.length === 0) {
      emptyEl.style.display = 'flex';
      listEl.innerHTML = '';
      summaryBar.style.display = 'none';
      listActions.style.display = 'none';
      return;
    }

    emptyEl.style.display = 'none';
    summaryBar.style.display = 'flex';
    listActions.style.display = 'flex';

    // 체크된 아이템 하단 이동
    const unchecked = items.filter(i => !i.checked);
    const checked = items.filter(i => i.checked);
    const sorted = [...unchecked, ...checked];

    listEl.innerHTML = sorted.map(item => this._renderItemCard(item)).join('');

    // 이벤트 바인딩
    listEl.querySelectorAll('.item-card-wrapper').forEach(wrapper => {
      const id = wrapper.dataset.id;
      const card = wrapper.querySelector('.item-card');
      card.querySelector('.item-check').addEventListener('click', e => {
        e.stopPropagation();
        Storage.toggleCheck(id);
        this._animateCheck(id, wrapper);
      });
      card.querySelector('.item-delete').addEventListener('click', e => {
        e.stopPropagation();
        this._deleteWithCollapse(wrapper, id);
      });
      const minusBtn = card.querySelector('.qty-minus');
      const plusBtn = card.querySelector('.qty-plus');
      if (minusBtn) {
        minusBtn.addEventListener('click', e => {
          e.stopPropagation();
          const item = Storage.getShoppingList().find(i => i.id === id);
          if (item && item.quantity > 1) {
            Storage.updateItem(id, { quantity: item.quantity - 1 });
            this.renderShoppingList();
          }
        });
      }
      if (plusBtn) {
        plusBtn.addEventListener('click', e => {
          e.stopPropagation();
          const item = Storage.getShoppingList().find(i => i.id === id);
          if (item) {
            Storage.updateItem(id, { quantity: item.quantity + 1 });
            this.renderShoppingList();
          }
        });
      }
      // 카드 클릭 → 상세 화면 (스와이프 중이면 무시)
      card.addEventListener('click', () => {
        if (wrapper._swiped) return;
        this.showDetail(id);
      });
      // 스와이프 바인딩
      this._bindSwipe(wrapper, id);
    });

    // 요약 업데이트
    const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const checkedCount = items.filter(i => i.checked).length;
    $('#summaryCount').textContent = `${checkedCount}/${items.length}개 완료`;
    $('#summaryTotal').textContent = total.toLocaleString();

    // 요약바 프로그레스
    const progressPct = items.length > 0 ? (checkedCount / items.length) * 100 : 0;
    const summaryProgress = $('#summaryProgress');
    if (items.length > 0) {
      summaryProgress.style.display = 'block';
      $('#summaryProgressFill').style.width = progressPct + '%';
    } else {
      summaryProgress.style.display = 'none';
    }

    // 재고 확인 버튼 상태
    const store = Storage.getMyStore();
    $('#btnCheckStock').disabled = !store;
    if (!store) {
      $('#btnCheckStock').textContent = '매장을 먼저 설정하세요';
    } else {
      $('#btnCheckStock').textContent = '재고 확인';
    }

    // 매장 설정 시 미확인 아이템 자동 재고 조회
    if (store && this.currentScreen === 'main') {
      this._autoCheckStock(store);
    }
  },

  _renderItemCard(item) {
    const checkedClass = item.checked ? ' checked' : '';
    const stockClass = item.stockStatus === 'in-stock' ? ' stock-ok' : (item.stockStatus === 'out-of-stock' ? ' stock-no' : '');
    const imgSrc = this._fixImageUrl(item.imageUrl);
    const imgHtml = imgSrc
      ? `<img class="item-image" src="${this._escapeHtml(imgSrc)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.className='item-image-placeholder';this.removeAttribute('src')">`
      : '<div class="item-image-placeholder"></div>';

    let stockHtml = '';
    if (item.stockStatus === 'in-stock') {
      stockHtml = `<span class="item-stock in-stock">재고 있음${item.stockQty ? ` (${item.stockQty})` : ''}</span>`;
    } else if (item.stockStatus === 'out-of-stock') {
      stockHtml = `<span class="item-stock out-of-stock">재고 없음</span>`;
    }

    const productIdHtml = item.productId
      ? `<span class="item-product-id">#${this._escapeHtml(item.productId)}</span>`
      : '';

    let locationHtml = '';
    if (item.displayLocation) {
      locationHtml = `<div class="item-location">${this._escapeHtml(item.displayLocation)}</div>`;
    }

    return `
      <li class="item-card-wrapper" data-id="${item.id}">
        <div class="swipe-delete-bg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          삭제
        </div>
        <div class="item-card${checkedClass}${stockClass}" data-id="${item.id}">
          <button class="item-check" aria-label="체크">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path class="tick-draw" d="M20 6L9 17l-5-5"/></svg>
          </button>
          ${imgHtml}
          <div class="item-info">
            <div class="item-name">${this._escapeHtml(item.name)}</div>
            <div class="item-meta">
              ${item.price ? `<span class="item-price">${item.price.toLocaleString()}원</span>` : ''}
              ${productIdHtml}
              ${stockHtml}
            </div>
            ${locationHtml}
          </div>
          <div class="item-qty">
            <button class="qty-minus" aria-label="수량 감소">-</button>
            <span>${item.quantity}</span>
            <button class="qty-plus" aria-label="수량 증가">+</button>
          </div>
          <button class="item-delete" aria-label="삭제">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>
      </li>
    `;
  },

  // ===== 내 매장 렌더링 =====

  renderMyStore() {
    const store = Storage.getMyStore();
    if (store) {
      $('#storeBarName').textContent = store.storeName;
    } else {
      $('#storeBarName').textContent = '매장을 설정해주세요';
    }
  },

  // ===== 제품 검색 =====

  async handleSearch() {
    const query = $('#searchInput').value.trim();
    if (!query) return;

    this.searchQuery = query;
    this.searchPage = 1;
    this._hideAutocomplete();
    $('#searchHistory').style.display = 'none';
    await this.loadSearchResults(false);
  },

  async loadSearchResults(append) {
    const resultsEl = $('#searchResults');
    const loadingEl = $('#searchLoading');

    if (!append) {
      resultsEl.innerHTML = '';
    } else {
      // 기존 "더 보기" 버튼 제거
      const moreBtn = resultsEl.querySelector('.btn-load-more');
      if (moreBtn) moreBtn.remove();
    }
    loadingEl.style.display = 'flex';

    try {
      const data = await DaisoAPI.searchProducts(this.searchQuery, this.searchPage, 20);

      loadingEl.style.display = 'none';

      if (!data) {
        resultsEl.innerHTML = '<div class="search-hint"><p>검색 결과를 불러올 수 없습니다</p></div>';
        return;
      }

      // 응답 구조에 따라 유연하게 처리
      let products = [];
      if (Array.isArray(data)) {
        products = data;
      } else if (data.products) {
        products = data.products;
      } else if (data.items) {
        products = data.items;
      } else if (data.data) {
        products = Array.isArray(data.data) ? data.data : (data.data.products || data.data.items || []);
      }

      // 첫 페이지 로드 시 검색 히스토리 저장
      if (!append) {
        const totalCount = data.totalCount || data.total || products.length;
        this._saveSearchHistory(this.searchQuery, totalCount);
      }

      if (products.length === 0 && !append) {
        resultsEl.innerHTML = '<div class="search-hint"><p>검색 결과가 없습니다</p><p class="empty-sub">다른 키워드로 검색해보세요</p></div>';
        return;
      }

      // 현재 장보기 리스트의 productId 목록
      const existingIds = new Set(Storage.getShoppingList().map(i => i.productId));

      const cardsHtml = products.map(p => {
        const productId = p.productId || p.id || p.product_id || p.code || '';
        const name = p.name || p.productName || p.product_name || p.title || '';
        const price = p.price || p.salePrice || p.sale_price || 0;
        const imageUrl = p.imageUrl || p.image || p.thumbnail || p.img || '';
        const fixedImageUrl = this._fixImageUrl(imageUrl);
        const isAdded = existingIds.has(productId);

        return `
          <div class="product-card" data-product='${this._escapeAttr(JSON.stringify({ productId, name, price, imageUrl }))}'>
            ${fixedImageUrl ? `<img class="product-image" src="${this._escapeHtml(fixedImageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.className='product-image-placeholder';this.removeAttribute('src')">` : '<div class="product-image-placeholder"></div>'}
            <div class="product-info">
              <div class="product-name">${this._escapeHtml(name)}</div>
              <div class="product-price">${price ? price.toLocaleString() + '원' : ''}${productId ? `<span class="product-id">#${this._escapeHtml(productId)}</span>` : ''}</div>
            </div>
            <button class="btn-add-product${isAdded ? ' added' : ''}">${isAdded ? '추가됨' : '추가'}</button>
          </div>
        `;
      }).join('');

      resultsEl.insertAdjacentHTML('beforeend', cardsHtml);

      // "추가" 버튼 이벤트
      resultsEl.querySelectorAll('.product-card').forEach(card => {
        const btn = card.querySelector('.btn-add-product');
        if (btn.classList.contains('added')) return;
        btn.addEventListener('click', () => {
          let product;
          try { product = JSON.parse(card.dataset.product); } catch { return; }
          Storage.addItem(product);
          btn.textContent = '추가됨';
          btn.classList.add('added');
          this.toast(`${product.name} 추가됨`);
        });
      });

      // 더 보기 버튼
      const totalPages = data.totalPages || data.total_pages;
      const hasMore = totalPages ? this.searchPage < totalPages : products.length >= 20;
      this.searchHasMore = hasMore;

      if (hasMore) {
        const moreBtnHtml = '<button class="btn-load-more">더 보기</button>';
        resultsEl.insertAdjacentHTML('beforeend', moreBtnHtml);
        resultsEl.querySelector('.btn-load-more').addEventListener('click', () => {
          this.searchPage++;
          this.loadSearchResults(true);
        });
      }

    } catch (e) {
      loadingEl.style.display = 'none';
      resultsEl.innerHTML = `<div class="search-hint"><p>검색 중 오류가 발생했습니다</p><p class="empty-sub">${this._escapeHtml(e.message)}</p></div>`;
    }
  },

  // ===== 매장 검색 =====

  renderStoreScreen() {
    const store = Storage.getMyStore();
    const infoEl = $('#currentStoreInfo');
    const cardEl = $('#currentStoreCard');

    if (store) {
      infoEl.style.display = 'block';
      cardEl.innerHTML = `
        <div class="store-name">${this._escapeHtml(store.storeName)}</div>
        <div class="store-address">${this._escapeHtml(store.address || '')}</div>
        ${store.openTime ? `<div class="store-hours">${store.openTime} ~ ${store.closeTime}</div>` : ''}
      `;
    } else {
      infoEl.style.display = 'none';
    }
  },

  async handleStoreSearch() {
    const query = $('#storeSearchInput').value.trim();
    if (!query) return;

    const resultsEl = $('#storeResults');
    const loadingEl = $('#storeLoading');

    resultsEl.innerHTML = '';
    loadingEl.style.display = 'flex';

    try {
      const data = await DaisoAPI.findStores(query);

      loadingEl.style.display = 'none';

      if (!data) {
        resultsEl.innerHTML = '<div class="search-hint"><p>매장 정보를 불러올 수 없습니다</p></div>';
        return;
      }

      let stores = [];
      if (Array.isArray(data)) {
        stores = data;
      } else if (data.stores) {
        stores = data.stores;
      } else if (data.items) {
        stores = data.items;
      } else if (data.data) {
        stores = Array.isArray(data.data) ? data.data : (data.data.stores || []);
      }

      if (stores.length === 0) {
        resultsEl.innerHTML = '<div class="search-hint"><p>검색 결과가 없습니다</p><p class="empty-sub">매장명이나 지역명으로 검색해보세요</p></div>';
        return;
      }

      const currentStore = Storage.getMyStore();

      resultsEl.innerHTML = stores.map(s => {
        const storeCode = s.storeCode || s.store_code || s.code || s.id || '';
        const storeName = s.storeName || s.store_name || s.name || '';
        const address = s.address || s.addr || s.roadAddress || '';
        const openTime = s.openTime || s.open_time || s.openingTime || '';
        const closeTime = s.closeTime || s.close_time || s.closingTime || '';
        const isSelected = currentStore && currentStore.storeCode === storeCode;

        return `
          <div class="store-card${isSelected ? ' selected' : ''}" data-store='${this._escapeAttr(JSON.stringify({ storeCode, storeName, address, openTime, closeTime }))}'>
            <div class="store-name">${this._escapeHtml(storeName)}</div>
            <div class="store-address">${this._escapeHtml(address)}</div>
            ${openTime ? `<div class="store-hours">${openTime} ~ ${closeTime}</div>` : ''}
            <button class="btn-set-store">${isSelected ? '현재 매장' : '내 매장 설정'}</button>
          </div>
        `;
      }).join('');

      // "내 매장 설정" 이벤트
      resultsEl.querySelectorAll('.store-card').forEach(card => {
        card.querySelector('.btn-set-store').addEventListener('click', () => {
          const store = JSON.parse(card.dataset.store);
          Storage.setMyStore(store);
          this.renderMyStore();
          this.renderStoreScreen();
          this.toast(`${store.storeName}이(가) 내 매장으로 설정되었습니다`);

          // 모든 카드 상태 업데이트
          resultsEl.querySelectorAll('.store-card').forEach(c => {
            c.classList.remove('selected');
            c.querySelector('.btn-set-store').textContent = '내 매장 설정';
          });
          card.classList.add('selected');
          card.querySelector('.btn-set-store').textContent = '현재 매장';
        });
      });

    } catch (e) {
      loadingEl.style.display = 'none';
      resultsEl.innerHTML = `<div class="search-hint"><p>매장 검색 중 오류가 발생했습니다</p><p class="empty-sub">${this._escapeHtml(e.message)}</p></div>`;
    }
  },

  // ===== 재고 일괄 확인 =====

  async checkAllStock() {
    const store = Storage.getMyStore();
    if (!store) {
      this.toast('매장을 먼저 설정해주세요', 'info');
      return;
    }

    const items = Storage.getShoppingList().filter(i => i.productId);
    if (items.length === 0) {
      this.toast('제품 ID가 있는 항목이 없습니다', 'info');
      return;
    }

    this.showScreen('stock');
    $('#stockStoreName').textContent = `${store.storeName} 재고 확인`;

    const stockList = $('#stockList');
    stockList.innerHTML = items.map(item => `
      <li class="stock-item" data-id="${item.id}">
        <div class="stock-item-info">
          <div class="stock-item-name">${this._escapeHtml(item.name)}</div>
          <div class="stock-item-status">
            <span class="stock-badge loading">확인 중...</span>
          </div>
        </div>
      </li>
    `).join('');

    // 프로그레스바 초기화
    $('#stockProgressFill').style.width = '0%';

    // 순차적으로 재고 + 진열위치 확인
    let completed = 0;
    for (const item of items) {
      $('#stockProgress').textContent = `${completed}/${items.length} 확인 완료`;
      $('#stockProgressFill').style.width = `${(completed / items.length) * 100}%`;

      const stockEl = stockList.querySelector(`[data-id="${item.id}"]`);
      const statusEl = stockEl.querySelector('.stock-item-status');

      try {
        // 재고 확인 — storeName으로 검색
        const inventory = await DaisoAPI.checkInventory(item.productId, store.storeName);

        let stockStatus = 'unchecked';
        let stockQty = '';
        let badges = '';
        let inventoryStoreCode = store.storeCode || '';

        if (inventory && inventory.storeInventory) {
          const stores = inventory.storeInventory.stores || [];
          const matched = stores.find(s => s.storeCode === store.storeCode)
            || stores.find(s => s.storeName === store.storeName)
            || stores[0];

          if (matched) {
            inventoryStoreCode = matched.storeCode;
            // storeCode가 없었으면 저장 (다음 조회 시 정확한 매칭용)
            if (!store.storeCode && matched.storeCode) {
              store.storeCode = matched.storeCode;
              Storage.setMyStore(store);
            }
            const qty = Number(matched.quantity) || 0;
            if (qty > 0) {
              stockStatus = 'in-stock';
              stockQty = qty;
              badges += `<span class="stock-badge available">재고 ${qty}개</span>`;
            } else {
              stockStatus = 'out-of-stock';
              badges += `<span class="stock-badge unavailable">재고 없음</span>`;
            }
          } else {
            badges += `<span class="stock-badge error">매장 정보 없음</span>`;
          }

          if (inventory.onlineStock > 0) {
            badges += `<span class="stock-badge location">온라인 ${inventory.onlineStock}개</span>`;
          }
        } else {
          badges += `<span class="stock-badge error">확인 불가</span>`;
        }

        // 진열 위치 확인
        let locationText = '';
        try {
          const locData = await DaisoAPI.getDisplayLocation(item.productId, inventoryStoreCode);
          if (locData && locData.hasLocation && locData.locations && locData.locations.length > 0) {
            const loc = locData.locations[0];
            const parts = [];
            if (loc.stairNo) {
              parts.push(Number(loc.stairNo) < 0 ? `B${Math.abs(loc.stairNo)}층` : `${loc.stairNo}층`);
            }
            if (loc.zoneNo) parts.push(`${loc.zoneNo}구역`);
            locationText = parts.join(' ');
            if (locationText) {
              badges += `<span class="stock-badge location">${this._escapeHtml(locationText)}</span>`;
            }
          }
        } catch {
          // 진열 위치 조회 실패 — 무시
        }

        statusEl.innerHTML = badges || '<span class="stock-badge error">정보 없음</span>';

        // 메인 리스트 아이템도 업데이트
        Storage.updateItem(item.id, {
          stockStatus,
          stockQty,
          displayLocation: locationText
        });

      } catch (e) {
        statusEl.innerHTML = `<span class="stock-badge error">오류: ${this._escapeHtml(e.message.substring(0, 30))}</span>`;
      }

      completed++;

      // Rate limit 방지 — 요청 간 500ms 대기
      if (completed < items.length) {
        await this._delay(500);
      }
    }

    $('#stockProgress').textContent = `${items.length}/${items.length} 확인 완료`;
    $('#stockProgressFill').style.width = '100%';
  },

  // ===== 자동 재고 확인 =====

  async _autoCheckStock(store) {
    if (this._autoCheckInProgress) return;

    const items = Storage.getShoppingList().filter(i =>
      i.productId && !i.stockStatus
    );
    if (items.length === 0) return;

    this._autoCheckInProgress = true;
    console.log('[자동재고] 확인 시작:', items.length, '개 아이템');

    for (const item of items) {
      // 화면 이탈 시 중단
      if (this.currentScreen !== 'main') {
        console.log('[자동재고] 화면 이탈로 중단');
        break;
      }

      try {
        console.log('[자동재고] 조회 중:', item.name, item.productId);
        const inventory = await DaisoAPI.checkInventory(item.productId, store.storeName);

        let stockStatus = 'unchecked';
        let stockQty = '';
        let inventoryStoreCode = store.storeCode || '';

        if (inventory && inventory.storeInventory) {
          const stores = inventory.storeInventory.stores || [];
          const matched = stores.find(s => s.storeCode === store.storeCode)
            || stores.find(s => s.storeName === store.storeName)
            || stores[0];

          if (matched) {
            inventoryStoreCode = matched.storeCode;
            if (!store.storeCode && matched.storeCode) {
              store.storeCode = matched.storeCode;
              Storage.setMyStore(store);
            }
            const qty = Number(matched.quantity) || 0;
            if (qty > 0) {
              stockStatus = 'in-stock';
              stockQty = qty;
            } else {
              stockStatus = 'out-of-stock';
            }
          }
        }

        // 진열 위치 확인
        let locationText = '';
        try {
          const locData = await DaisoAPI.getDisplayLocation(item.productId, inventoryStoreCode);
          if (locData && locData.hasLocation && locData.locations && locData.locations.length > 0) {
            const loc = locData.locations[0];
            const parts = [];
            if (loc.stairNo) {
              parts.push(Number(loc.stairNo) < 0 ? `B${Math.abs(loc.stairNo)}층` : `${loc.stairNo}층`);
            }
            if (loc.zoneNo) parts.push(`${loc.zoneNo}구역`);
            locationText = parts.join(' ');
          }
        } catch (locErr) {
          console.log('[자동재고] 위치 조회 실패:', locErr.message);
        }

        console.log('[자동재고] 결과:', item.name, stockStatus, stockQty, locationText);

        // Storage 업데이트
        Storage.updateItem(item.id, { stockStatus, stockQty, displayLocation: locationText });

        // DOM 직접 업데이트 (리렌더 없이)
        this._updateItemCardStock(item.id, stockStatus, stockQty, locationText);

      } catch (err) {
        console.error('[자동재고] 조회 실패:', item.name, err.message);
      }

      // Rate limit 방지
      await this._delay(500);
    }

    console.log('[자동재고] 완료');
    this._autoCheckInProgress = false;
  },

  _updateItemCardStock(id, stockStatus, stockQty, displayLocation) {
    const wrapper = document.querySelector(`.item-card-wrapper[data-id="${id}"]`);
    if (!wrapper) return;

    const card = wrapper.querySelector('.item-card');
    const meta = card.querySelector('.item-meta');

    // 기존 재고 배지 제거
    const existingStock = meta.querySelector('.item-stock');
    if (existingStock) existingStock.remove();

    // 재고 배지 추가
    if (stockStatus === 'in-stock') {
      meta.insertAdjacentHTML('beforeend', `<span class="item-stock in-stock">재고 ${stockQty}개</span>`);
    } else if (stockStatus === 'out-of-stock') {
      meta.insertAdjacentHTML('beforeend', `<span class="item-stock out-of-stock">재고 없음</span>`);
    }

    // 카드 재고 클래스 업데이트
    card.classList.remove('stock-ok', 'stock-no');
    if (stockStatus === 'in-stock') card.classList.add('stock-ok');
    else if (stockStatus === 'out-of-stock') card.classList.add('stock-no');

    // 진열 위치
    const info = card.querySelector('.item-info');
    let locEl = info.querySelector('.item-location');
    if (displayLocation) {
      if (!locEl) {
        info.insertAdjacentHTML('beforeend', `<div class="item-location">${this._escapeHtml(displayLocation)}</div>`);
      } else {
        locEl.textContent = displayLocation;
      }
    }
  },

  // ===== 제품 상세 화면 =====

  _detailItemId: null,

  showDetail(id) {
    const item = Storage.getShoppingList().find(i => i.id === id);
    if (!item) return;

    this._detailItemId = id;
    const imgSrc = this._fixImageUrl(item.imageUrl);

    const imgEl = $('#detailImage');
    const placeholderEl = $('#detailImagePlaceholder');
    if (imgSrc) {
      imgEl.src = imgSrc;
      imgEl.style.display = 'block';
      placeholderEl.style.display = 'none';
      imgEl.onerror = () => {
        imgEl.style.display = 'none';
        placeholderEl.style.display = 'flex';
      };
    } else {
      imgEl.style.display = 'none';
      placeholderEl.style.display = 'flex';
    }

    $('#detailName').textContent = item.name;
    $('#detailPrice').textContent = item.price ? item.price.toLocaleString() + '원' : '가격 정보 없음';

    const idEl = $('#detailId');
    if (item.productId) {
      idEl.textContent = '#' + item.productId;
      idEl.style.display = 'inline-block';
    } else {
      idEl.style.display = 'none';
    }

    // 재고 정보
    const stockSection = $('#detailStockSection');
    const stockBadges = $('#detailStockBadges');
    if (item.stockStatus && item.stockStatus !== 'unchecked') {
      stockSection.style.display = 'block';
      if (item.stockStatus === 'in-stock') {
        stockBadges.innerHTML = `<span class="stock-badge available">재고 있음${item.stockQty ? ` (${item.stockQty}개)` : ''}</span>`;
      } else {
        stockBadges.innerHTML = '<span class="stock-badge unavailable">재고 없음</span>';
      }
    } else {
      stockSection.style.display = 'none';
    }

    // 진열 위치
    const locSection = $('#detailLocationSection');
    if (item.displayLocation) {
      locSection.style.display = 'block';
      $('#detailLocation').textContent = item.displayLocation;
    } else {
      locSection.style.display = 'none';
    }

    // 수량
    $('#detailQtyValue').textContent = item.quantity;

    this.showScreen('detail');
  },

  _bindDetailEvents() {
    $('#detailQtyMinus').addEventListener('click', () => {
      if (!this._detailItemId) return;
      const item = Storage.getShoppingList().find(i => i.id === this._detailItemId);
      if (item && item.quantity > 1) {
        Storage.updateItem(this._detailItemId, { quantity: item.quantity - 1 });
        $('#detailQtyValue').textContent = item.quantity - 1;
      }
    });
    $('#detailQtyPlus').addEventListener('click', () => {
      if (!this._detailItemId) return;
      const item = Storage.getShoppingList().find(i => i.id === this._detailItemId);
      if (item) {
        Storage.updateItem(this._detailItemId, { quantity: item.quantity + 1 });
        $('#detailQtyValue').textContent = item.quantity + 1;
      }
    });
    $('#btnDetailDelete').addEventListener('click', () => {
      if (!this._detailItemId) return;
      const item = Storage.getShoppingList().find(i => i.id === this._detailItemId);
      Storage.removeItem(this._detailItemId);
      this._detailItemId = null;
      this.goBack();
      this.toast(`${item ? item.name : '제품'} 삭제됨`, 'error');
    });
  },

  // ===== 직접 추가 모달 =====

  showManualAddModal() {
    $('#manualName').value = '';
    $('#manualPrice').value = '';
    $('#manualQty').value = '1';
    $('#modalOverlay').style.display = 'flex';
    setTimeout(() => $('#manualName').focus(), 100);
  },

  hideModal() {
    $('#modalOverlay').style.display = 'none';
  },

  handleManualAdd() {
    const name = $('#manualName').value.trim();
    if (!name) {
      this.toast('제품명을 입력해주세요', 'info');
      return;
    }
    const price = parseInt($('#manualPrice').value) || 0;
    const quantity = Math.max(1, parseInt($('#manualQty').value) || 1);

    Storage.addItem({ name, price, quantity });
    this.hideModal();
    this.renderShoppingList();
    this.toast(`${name} 추가됨`);
  },

  // ===== 확인 다이얼로그 =====

  showConfirm(message, callback) {
    $('#confirmMessage').textContent = message;
    this.confirmCallback = callback;
    $('#confirmOverlay').style.display = 'flex';
  },

  hideConfirm() {
    $('#confirmOverlay').style.display = 'none';
    this.confirmCallback = null;
  },

  // ===== 토스트 =====

  toast(msg, type = 'success') {
    const el = $('#toast');
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    el.className = 'toast';
    el.innerHTML = (icons[type] || '') + `<span>${this._escapeHtml(msg)}</span>`;
    el.classList.add(type, 'show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
  },

  // ===== 스와이프 삭제 =====

  _bindSwipe(wrapper, id) {
    const card = wrapper.querySelector('.item-card');
    let startX = 0, startY = 0, deltaX = 0, swiping = false, decided = false;

    card.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      deltaX = 0;
      swiping = false;
      decided = false;
      wrapper._swiped = false;
      card.classList.remove('swiping');
    }, { passive: true });

    card.addEventListener('touchmove', e => {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!decided) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        decided = true;
        swiping = Math.abs(dx) > Math.abs(dy);
        if (swiping) card.classList.add('swiping');
      }

      if (!swiping) return;
      e.preventDefault();
      deltaX = Math.min(0, dx);
      card.style.transform = `translateX(${deltaX}px)`;
    }, { passive: false });

    card.addEventListener('touchend', () => {
      card.classList.remove('swiping');
      if (!swiping) return;
      wrapper._swiped = true;

      if (deltaX < -80) {
        card.style.transition = 'transform 0.2s ease';
        card.style.transform = 'translateX(-100%)';
        setTimeout(() => this._deleteWithCollapse(wrapper, id), 200);
      } else {
        card.style.transition = 'transform 0.2s ease';
        card.style.transform = 'translateX(0)';
      }
      setTimeout(() => {
        card.style.transition = '';
      }, 200);
    }, { passive: true });
  },

  _deleteWithCollapse(wrapper, id) {
    wrapper.style.maxHeight = wrapper.offsetHeight + 'px';
    requestAnimationFrame(() => {
      wrapper.classList.add('collapsing');
    });
    setTimeout(() => {
      Storage.removeItem(id);
      this.renderShoppingList();
      this.toast('삭제됨', 'error');
    }, 300);
  },

  // ===== 체크 애니메이션 =====

  _animateCheck(id, wrapper) {
    const card = wrapper.querySelector('.item-card');
    const item = Storage.getShoppingList().find(i => i.id === id);
    if (!item) return;

    const checkEl = card.querySelector('.item-check');
    const nameEl = card.querySelector('.item-name');

    if (item.checked) {
      // 체크됨 상태
      card.classList.add('checked');
      checkEl.classList.add('check-bounce');
      nameEl.style.textDecoration = 'line-through';
      nameEl.style.color = 'var(--text-muted)';

      setTimeout(() => {
        checkEl.classList.remove('check-bounce');
        this.renderShoppingList();
      }, 400);
    } else {
      // 체크 해제
      card.classList.remove('checked');
      nameEl.style.textDecoration = '';
      nameEl.style.color = '';

      setTimeout(() => this.renderShoppingList(), 300);
    }
  },

  // ===== 검색 히스토리 =====

  _getSearchHistory() {
    try {
      // 기존 daiso_recent_searches 마이그레이션
      const oldData = localStorage.getItem('daiso_recent_searches');
      if (oldData) {
        const oldSearches = JSON.parse(oldData);
        if (Array.isArray(oldSearches) && oldSearches.length > 0) {
          const migrated = oldSearches.map((q, i) => ({
            query: q,
            timestamp: Date.now() - (i * 60000),
            resultCount: 0
          }));
          localStorage.setItem('daiso_search_history', JSON.stringify(migrated));
          localStorage.removeItem('daiso_recent_searches');
          return migrated;
        }
        localStorage.removeItem('daiso_recent_searches');
      }
      return JSON.parse(localStorage.getItem('daiso_search_history') || '[]');
    } catch { return []; }
  },

  _saveSearchHistory(query, resultCount) {
    if (!query) return;
    let history = this._getSearchHistory().filter(h => h.query !== query);
    history.unshift({ query, timestamp: Date.now(), resultCount: resultCount || 0 });
    history = history.slice(0, 10);
    localStorage.setItem('daiso_search_history', JSON.stringify(history));
  },

  _clearSearchHistory() {
    localStorage.removeItem('daiso_search_history');
    this._renderSearchHistory();
  },

  _formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days === 1) return '어제';
    if (days < 30) return `${days}일 전`;
    return `${Math.floor(days / 30)}달 전`;
  },

  _renderSearchHistory() {
    const container = $('#searchHistory');
    if (!container) return;
    const history = this._getSearchHistory();

    if (history.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    container.innerHTML = `
      <div class="search-history-header">
        <span>검색 기록</span>
        <button id="btnClearHistory">전체 삭제</button>
      </div>
      ${history.map(h => `
        <div class="search-history-item" data-query="${this._escapeAttr(h.query)}">
          <div class="search-history-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="search-history-content">
            <div class="search-history-query">${this._escapeHtml(h.query)}</div>
            <div class="search-history-meta">${this._formatTimeAgo(h.timestamp)}${h.resultCount > 0 ? ` · ${h.resultCount}건` : ''}</div>
          </div>
          <button class="search-history-action" aria-label="재검색">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      `).join('')}
    `;

    // 전체 삭제
    container.querySelector('#btnClearHistory').addEventListener('click', (e) => {
      e.stopPropagation();
      this._clearSearchHistory();
      this.toast('검색 기록이 삭제되었습니다', 'info');
    });

    // 항목 클릭 → 재검색
    container.querySelectorAll('.search-history-item').forEach(item => {
      item.addEventListener('click', () => {
        const query = item.dataset.query;
        $('#searchInput').value = query;
        $('#searchClear').style.display = 'flex';
        this.handleSearch();
      });
    });
  },

  // ===== 자동완성 =====

  _onSearchInput(value) {
    if (!value) {
      this._hideAutocomplete();
      this._renderSearchHistory();
      clearTimeout(this._autocompleteTimer);
      return;
    }

    // 히스토리 숨기기
    const historyEl = $('#searchHistory');
    if (historyEl) historyEl.style.display = 'none';
    const hintEl = $('#searchHint');
    if (hintEl) hintEl.style.display = 'none';

    // 즉시 로컬 매칭
    const localResults = this._getLocalSuggestions(value);
    this._renderAutocomplete(localResults, [], value, true);

    // 디바운스 API 호출
    clearTimeout(this._autocompleteTimer);
    this._autocompleteTimer = setTimeout(async () => {
      try {
        this._autocompleteLoading = true;
        this._renderAutocomplete(localResults, [], value, true);
        const apiResults = await this._getApiSuggestions(value);
        this._autocompleteLoading = false;
        // 입력값이 변경되지 않았을 때만 렌더링
        if ($('#searchInput').value.trim() === value) {
          this._renderAutocomplete(localResults, apiResults, value, false);
        }
      } catch {
        this._autocompleteLoading = false;
      }
    }, 500);
  },

  _getLocalSuggestions(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    // 소스 1: 검색 히스토리
    const history = this._getSearchHistory();
    const historyMatches = history
      .filter(h => h.query.toLowerCase().includes(lowerQuery) && h.query !== query)
      .slice(0, 3);
    historyMatches.forEach(h => {
      results.push({ text: h.query, type: 'history' });
    });

    // 소스 2: 장보기 리스트 제품명
    const shoppingList = Storage.getShoppingList();
    const listMatches = shoppingList
      .filter(item => item.name.toLowerCase().includes(lowerQuery))
      .slice(0, 3);
    listMatches.forEach(item => {
      if (!results.some(r => r.text === item.name)) {
        results.push({ text: item.name, type: 'list' });
      }
    });

    return results;
  },

  async _getApiSuggestions(query) {
    try {
      const data = await DaisoAPI.searchProducts(query, 1, 5);
      if (!data) return [];

      let products = [];
      if (Array.isArray(data)) products = data;
      else if (data.products) products = data.products;
      else if (data.items) products = data.items;
      else if (data.data) products = Array.isArray(data.data) ? data.data : (data.data.products || data.data.items || []);

      return products.slice(0, 5).map(p => ({
        text: p.name || p.productName || p.product_name || p.title || '',
        type: 'api',
        productData: p
      }));
    } catch {
      return [];
    }
  },

  _renderAutocomplete(localResults, apiResults, query, loading) {
    const dropdown = $('#autocompleteDropdown');
    if (!dropdown) return;

    if (localResults.length === 0 && apiResults.length === 0 && !loading) {
      dropdown.style.display = 'none';
      return;
    }

    let html = '';
    const lowerQuery = query.toLowerCase();

    const highlightMatch = (text) => {
      const idx = text.toLowerCase().indexOf(lowerQuery);
      if (idx === -1) return this._escapeHtml(text);
      const before = text.substring(0, idx);
      const match = text.substring(idx, idx + query.length);
      const after = text.substring(idx + query.length);
      return `${this._escapeHtml(before)}<span class="highlight">${this._escapeHtml(match)}</span>${this._escapeHtml(after)}`;
    };

    // 로컬: 최근 검색
    const historyItems = localResults.filter(r => r.type === 'history');
    if (historyItems.length > 0) {
      html += '<div class="autocomplete-section-title">최근 검색</div>';
      historyItems.forEach(item => {
        html += `
          <div class="autocomplete-item" data-text="${this._escapeAttr(item.text)}" data-type="history">
            <div class="autocomplete-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <span>${highlightMatch(item.text)}</span>
          </div>
        `;
      });
    }

    // 로컬: 내 리스트
    const listItems = localResults.filter(r => r.type === 'list');
    if (listItems.length > 0) {
      html += '<div class="autocomplete-section-title">내 리스트</div>';
      listItems.forEach(item => {
        html += `
          <div class="autocomplete-item" data-text="${this._escapeAttr(item.text)}" data-type="list">
            <div class="autocomplete-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
            </div>
            <span>${highlightMatch(item.text)}</span>
          </div>
        `;
      });
    }

    // API 결과
    if (apiResults.length > 0) {
      html += '<div class="autocomplete-section-title">추천 제품</div>';
      apiResults.forEach(item => {
        html += `
          <div class="autocomplete-item" data-text="${this._escapeAttr(item.text)}" data-type="api">
            <div class="autocomplete-item-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </div>
            <span>${highlightMatch(item.text)}</span>
          </div>
        `;
      });
    }

    // 로딩 표시
    if (loading && this._autocompleteLoading) {
      html += '<div class="autocomplete-loading"><div class="mini-spinner"></div>추천 검색 중...</div>';
    }

    dropdown.innerHTML = html;
    dropdown.style.display = html ? 'block' : 'none';

    // 클릭 이벤트
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault(); // blur 방지
        const text = item.dataset.text;
        $('#searchInput').value = text;
        $('#searchClear').style.display = 'flex';
        this._hideAutocomplete();
        this.handleSearch();
      });
    });
  },

  _hideAutocomplete() {
    const dropdown = $('#autocompleteDropdown');
    if (dropdown) dropdown.style.display = 'none';
    clearTimeout(this._autocompleteTimer);
  },

  // ===== 리플 효과 =====

  _initRipple() {
    document.querySelectorAll('.tab-item, .btn-add-product, .btn-check-stock, .btn-empty-search, .btn-empty-add').forEach(el => {
      el.classList.add('ripple-target');
    });
    document.addEventListener('click', e => {
      const target = e.target.closest('.ripple-target');
      if (!target) return;
      this._addRipple(e, target);
    });
  },

  _addRipple(e, target) {
    const rect = target.getBoundingClientRect();
    const circle = document.createElement('span');
    circle.className = 'ripple-circle';
    circle.style.left = (e.clientX - rect.left) + 'px';
    circle.style.top = (e.clientY - rect.top) + 'px';
    target.appendChild(circle);
    setTimeout(() => circle.remove(), 500);
  },

  // ===== 유틸 =====

  _fixImageUrl(url) {
    if (!url) return '';
    return url.replace('img.daisomall.co.kr', 'cdn.daisomall.co.kr');
  },

  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  _escapeAttr(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
};

// 유틸 — 짧은 셀렉터
function $(selector) {
  return document.querySelector(selector);
}

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => App.init());
