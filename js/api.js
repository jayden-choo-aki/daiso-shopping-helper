/**
 * 다이소 MCP 도구 래퍼 함수
 * mcpClient 인스턴스를 통해 MCP 도구 호출
 */
const DaisoAPI = {
  /**
   * MCP 응답에서 텍스트 컨텐츠 추출
   */
  _extractContent(result) {
    if (!result || !result.content) return null;
    const textContent = result.content.find(c => c.type === 'text');
    if (!textContent) return null;
    try {
      return JSON.parse(textContent.text);
    } catch {
      return textContent.text;
    }
  },

  /**
   * 제품 검색
   * @param {string} query - 검색 키워드 (필수)
   * @param {number} page - 페이지 번호 (기본 1)
   * @param {number} pageSize - 페이지당 결과 수 (기본 20)
   */
  async searchProducts(query, page = 1, pageSize = 20) {
    const args = { query };
    if (page > 1) args.page = page;
    if (pageSize !== 20) args.pageSize = pageSize;
    const result = await mcpClient.callTool('daiso_search_products', args);
    return this._extractContent(result);
  },

  /**
   * 매장 검색
   * @param {string} keyword - 매장명 키워드
   * @param {string} sido - 시/도
   * @param {string} gugun - 구/군
   */
  async findStores(keyword, sido, gugun) {
    const args = {};
    if (keyword) args.keyword = keyword;
    if (sido) args.sido = sido;
    if (gugun) args.gugun = gugun;
    const result = await mcpClient.callTool('daiso_find_stores', args);
    return this._extractContent(result);
  },

  /**
   * 재고 확인
   * @param {string} productId - 제품 ID (필수)
   * @param {string} storeQuery - 매장 검색어 또는 매장 코드
   */
  async checkInventory(productId, storeQuery) {
    const args = { productId };
    if (storeQuery) args.storeQuery = storeQuery;
    const result = await mcpClient.callTool('daiso_check_inventory', args);
    return this._extractContent(result);
  },

  /**
   * 진열 위치 확인
   * @param {string} productId - 제품 ID (필수)
   * @param {string} storeCode - 매장 코드 (필수)
   */
  async getDisplayLocation(productId, storeCode) {
    const args = { productId, storeCode };
    const result = await mcpClient.callTool('daiso_get_display_location', args);
    return this._extractContent(result);
  },

  /**
   * 가격 정보 조회
   * @param {string} productId - 제품 ID (필수)
   */
  async getPriceInfo(productId) {
    const args = { productId };
    const result = await mcpClient.callTool('daiso_get_price_info', args);
    return this._extractContent(result);
  }
};
