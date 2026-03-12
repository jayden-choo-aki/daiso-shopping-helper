/**
 * localStorage CRUD 관리
 */
const Storage = {
  KEYS: {
    SHOPPING_LIST: 'daiso_shopping_list',
    MY_STORE: 'daiso_my_store'
  },

  // === 장보기 리스트 ===

  /**
   * 장보기 리스트 전체 조회
   */
  getShoppingList() {
    const data = localStorage.getItem(this.KEYS.SHOPPING_LIST);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      return parsed.items || [];
    } catch {
      return [];
    }
  },

  /**
   * 장보기 리스트 저장
   */
  saveShoppingList(items) {
    localStorage.setItem(this.KEYS.SHOPPING_LIST, JSON.stringify({ items }));
  },

  /**
   * 아이템 추가
   */
  addItem(item) {
    const items = this.getShoppingList();
    items.push({
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      productId: item.productId || '',
      name: item.name,
      price: item.price || 0,
      imageUrl: item.imageUrl || '',
      checked: false,
      quantity: item.quantity || 1,
      addedAt: new Date().toISOString()
    });
    this.saveShoppingList(items);
    return items;
  },

  /**
   * 아이템 삭제
   */
  removeItem(id) {
    const items = this.getShoppingList().filter(item => item.id !== id);
    this.saveShoppingList(items);
    return items;
  },

  /**
   * 아이템 업데이트
   */
  updateItem(id, updates) {
    const items = this.getShoppingList();
    const idx = items.findIndex(item => item.id === id);
    if (idx !== -1) {
      items[idx] = { ...items[idx], ...updates };
    }
    this.saveShoppingList(items);
    return items;
  },

  /**
   * 체크 토글
   */
  toggleCheck(id) {
    const items = this.getShoppingList();
    const item = items.find(item => item.id === id);
    if (item) {
      item.checked = !item.checked;
    }
    this.saveShoppingList(items);
    return items;
  },

  /**
   * 리스트 초기화
   */
  clearShoppingList() {
    this.saveShoppingList([]);
  },

  /**
   * 총 예상 금액 계산 (체크되지 않은 아이템)
   */
  getTotalPrice() {
    return this.getShoppingList()
      .reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  // === 내 매장 ===

  /**
   * 내 매장 조회
   */
  getMyStore() {
    const data = localStorage.getItem(this.KEYS.MY_STORE);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  /**
   * 내 매장 저장
   */
  setMyStore(store) {
    localStorage.setItem(this.KEYS.MY_STORE, JSON.stringify(store));
  },

  /**
   * 내 매장 삭제
   */
  removeMyStore() {
    localStorage.removeItem(this.KEYS.MY_STORE);
  }
};
