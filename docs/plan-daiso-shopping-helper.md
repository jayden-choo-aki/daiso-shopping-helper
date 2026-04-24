# 다이소 장보기 도우미 기획안

## 1. 프로젝트 개요

**목적**: 다이소 매장 방문 전 제품 검색, 장보기 리스트 관리, 매장별 재고/진열 위치 확인을 하나의 모바일 웹앱으로 제공

**핵심 기능**:
- 다이소 제품 검색 및 장보기 리스트 관리
- 내 매장 설정 (매장 검색)
- 매장별 재고 일괄 확인
- 매장 내 진열 위치(구역/층) 조회
- 오프라인 대응 (localStorage 기반 데이터 유지)

---

## 2. 시스템 구조

```
[사용자 (모바일 브라우저)]
        ↓
[정적 웹앱 (HTML/CSS/JS)]
        ↓
[MCP 클라이언트 (JSON-RPC over HTTP+SSE)]
        ↓
[MCP 서버: mcp.aka.page/mcp]
        ↓
[다이소 API (제품검색, 매장검색, 재고확인, 진열위치)]
```

### 데이터 흐름

```
제품 검색:  사용자 입력 → MCP daiso_search_products → 검색 결과 렌더링
매장 검색:  사용자 입력 → MCP daiso_find_stores → 매장 목록 렌더링 → 내 매장 저장 (localStorage)
재고 확인:  리스트 제품 → MCP daiso_check_inventory (storeName) → 매장 재고 표시
진열 위치:  재고 확인 후 → MCP daiso_get_display_location (storeCode) → 구역/층 표시
```

---

## 3. 사용 시나리오

### 시나리오 1: 제품 검색 후 리스트 추가
```
1. 하단 "제품 검색" 버튼 클릭
2. 검색어 입력 (예: "접시꽂이")
3. 검색 결과에서 "추가" 버튼 클릭
4. 메인 화면 장보기 리스트에 제품 추가됨
5. 수량 조절 가능 (+/- 버튼)
```

### 시나리오 2: 매장 설정
```
1. 헤더 매장 아이콘 또는 매장 바 "변경" 클릭
2. 매장명/지역 검색 (예: "상일동역")
3. 검색 결과에서 "내 매장 설정" 클릭
4. 메인 화면 상단에 매장명 표시
```

### 시나리오 3: 재고 일괄 확인
```
1. 매장 설정 완료 상태에서 "재고 확인" 클릭
2. 리스트의 모든 제품을 순차적으로 재고 조회
3. 각 제품별 재고 수량 + 진열 위치(구역/층) 표시
4. 예: "재고 없음" / "재고 5개" + "B1층 15구역"
```

### 시나리오 4: 직접 추가
```
1. 하단 "+" 버튼 클릭
2. 제품명, 가격, 수량 입력
3. 검색 없이 리스트에 수동 추가
4. (productId 없으므로 재고 확인 불가)
```

---

## 4. 기술 스택

| 구분 | 기술 | 비고 |
|------|------|------|
| 프론트엔드 | HTML5 + CSS3 + Vanilla JS | 프레임워크 없음 |
| 통신 프로토콜 | MCP (Model Context Protocol) | JSON-RPC 2.0 over HTTP + SSE |
| MCP 서버 | mcp.aka.page/mcp | 다이소 API 래핑 |
| 데이터 저장 | localStorage | 장보기 리스트 + 내 매장 |
| PWA | manifest.json | standalone 모드, 홈 화면 추가 가능 |
| 폰트 | Noto Sans KR (Google Fonts) | 400/500/700 |
| 디자인 | 모바일 퍼스트 | 480px 이상 시 중앙 정렬 |

---

## 5. MCP 도구 스펙

### 5.1 daiso_search_products (제품 검색)

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| query | string | O | 검색 키워드 |
| page | number | X | 페이지 번호 (기본 1) |
| pageSize | number | X | 페이지당 결과 수 (기본 30) |

**응답 구조:**
```json
{
  "products": [
    {
      "productId": "1047862",
      "name": "스테인리스접시꽂이(4칸)",
      "price": 3000,
      "imageUrl": "https://..."
    }
  ],
  "totalPages": 5
}
```

### 5.2 daiso_find_stores (매장 검색)

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| keyword | string | X | 매장명/주소 키워드 |
| sido | string | X | 시/도 |
| gugun | string | X | 구/군 |
| dong | string | X | 동 |
| limit | number | X | 최대 매장 수 (기본 50) |

**응답 구조:**
```json
{
  "stores": [
    {
      "storeCode": "10972",
      "storeName": "상일동역점",
      "address": "서울특별시 강동구 고덕로 399",
      "openTime": "10:00",
      "closeTime": "22:00"
    }
  ]
}
```

### 5.3 daiso_check_inventory (재고 확인)

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| productId | string | O | 제품 ID |
| storeQuery | string | X | 매장 검색어 (매장명/주소) |
| latitude | number | X | 위도 (기본 37.5665) |
| longitude | number | X | 경도 (기본 126.978) |

**응답 구조:**
```json
{
  "productId": "1047862",
  "onlineStock": 88,
  "storeInventory": {
    "totalStores": 1,
    "inStockCount": 0,
    "outOfStockCount": 1,
    "stores": [
      {
        "storeCode": "10972",
        "storeName": "상일동역점",
        "quantity": 0,
        "distance": "16.9"
      }
    ]
  }
}
```

### 5.4 daiso_get_display_location (진열 위치)

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| productId | string | O | 상품 ID |
| storeCode | string | O | 매장 코드 (check_inventory 결과에서 획득) |

**응답 구조:**
```json
{
  "productId": "1047862",
  "storeCode": "10972",
  "hasLocation": true,
  "locations": [
    {
      "zoneNo": "15",
      "stairNo": "-1"
    }
  ]
}
```
- `stairNo`: "-1" → B1층, "1" → 1층
- `zoneNo`: 매장 내 구역 번호

### 5.5 daiso_get_price_info (가격 정보)

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| productId | string | X | 제품 ID |
| productName | string | X | 제품명 (productId 없을 경우) |

---

## 6. 화면 구성

### 6.1 메인 화면 (장보기 리스트)
- 상단: 헤더 (타이틀 + 매장 설정 버튼)
- 매장 바: 현재 설정된 매장명 + 변경 버튼
- 리스트: 제품 카드 (체크/이미지/이름/가격/재고상태/수량/삭제)
- 하단 요약: 제품 수 + 예상 금액 + 재고 확인 버튼
- 하단 액션: 제품 검색 + 직접 추가 버튼
- 리스트 관리: 체크 삭제 + 전체 초기화

### 6.2 제품 검색 화면
- 검색 바: 키워드 입력 + 클리어 버튼
- 검색 결과: 제품 카드 (이미지/이름/가격/추가 버튼)
- 더 보기: 페이지네이션

### 6.3 매장 설정 화면
- 검색 바: 매장명/지역 입력
- 검색 결과: 매장 카드 (이름/주소/영업시간/설정 버튼)
- 현재 매장: 설정된 매장 정보 + 해제 버튼

### 6.4 재고 확인 화면
- 헤더: 매장명 + 진행 상황
- 리스트: 제품별 재고 배지 (재고 수량/재고 없음/온라인 재고/진열 위치)

### 6.5 모달
- 직접 추가 모달: 제품명/가격/수량 입력
- 확인 다이얼로그: 삭제/초기화 확인

---

## 7. 데이터 구조

### localStorage 키

| 키 | 용도 | 구조 |
|----|------|------|
| `daiso_shopping_list` | 장보기 리스트 | `{ items: [...] }` |
| `daiso_my_store` | 내 매장 정보 | `{ storeCode, storeName, address, ... }` |

### 장보기 아이템 구조

```json
{
  "id": "1710000000000",
  "productId": "1047862",
  "name": "스테인리스접시꽂이(4칸)",
  "price": 3000,
  "imageUrl": "https://...",
  "checked": false,
  "quantity": 1,
  "addedAt": "2026-03-12T10:00:00.000Z",
  "stockStatus": "in-stock",
  "stockQty": 5,
  "displayLocation": "B1층 15구역"
}
```

---

## 8. 폴더 구조

```
daiso-shopping-helper/
├── index.html          # 싱글페이지 앱 (4개 화면 + 모달)
├── manifest.json       # PWA 매니페스트
├── css/
│   └── style.css       # 전체 스타일 (모바일 퍼스트)
├── js/
│   ├── mcp-client.js   # MCP 클라이언트 (JSON-RPC + SSE)
│   ├── storage.js      # localStorage CRUD
│   ├── api.js          # MCP 도구 래퍼 (DaisoAPI)
│   └── app.js          # 메인 앱 로직 (App 객체)
└── images/             # (비어있음)
```

---

## 9. 구현 단계

### Phase 1: MVP (완료)
- [x] 프로젝트 구조 설정
- [x] MCP 클라이언트 구현 (세션 관리, SSE 파싱)
- [x] 제품 검색 기능
- [x] 장보기 리스트 CRUD (추가/삭제/체크/수량)
- [x] 직접 추가 모달
- [x] 매장 검색 및 설정
- [x] 재고 일괄 확인
- [x] 진열 위치 조회
- [x] 토스트 알림
- [x] PWA manifest.json

### Phase 2: 안정화 (진행 중)
- [x] MCP 응답 구조에 맞는 재고 파싱 수정 (`storeInventory.stores[]`)
- [x] 진열 위치 파싱 수정 (`locations[].zoneNo/stairNo`)
- [x] `checkInventory`에 매장명(storeName) 전달 (storeCode 아님)
- [x] 브라우저 캐시 문제 대응 (버전 쿼리스트링 적용)
- [ ] MCP 세션 만료 시 자동 재연결 안정화
- [ ] 에러 메시지 사용자 친화적으로 개선
- [ ] 오프라인 상태 감지 및 안내

### Phase 3: UX 개선
- [ ] 검색 디바운싱 (자동 검색)
- [ ] 리스트 드래그 정렬
- [ ] 스와이프 삭제
- [ ] 제품 카테고리 필터
- [ ] 최근 검색어 저장
- [ ] 리스트 공유 기능 (URL 또는 텍스트 복사)

### Phase 4: PWA 강화
- [ ] Service Worker 구현 (오프라인 캐싱)
- [ ] 앱 아이콘 제작 (PNG)
- [ ] 스플래시 스크린
- [ ] 푸시 알림 (재고 변동 알림)

### Phase 5: 고도화 (선택)
- [ ] 가격 변동 알림
- [ ] 매장 즐겨찾기 (복수 매장)
- [ ] 구매 이력 관리
- [ ] 지도 기반 주변 매장 검색

---

## 10. 위험 요소 및 대응

| 위험 | 가능성 | 대응 방안 |
|------|--------|----------|
| MCP 서버 장애/변경 | 중 | 에러 핸들링, 재시도 로직 |
| 다이소 API 응답 구조 변경 | 중 | 유연한 파싱 (다양한 필드명 대응) |
| MCP 세션 만료 | 높음 | 자동 재초기화 구현 (현재 적용됨) |
| 브라우저 localStorage 한도 | 하 | 약 5MB로 충분, 필요시 IndexedDB |
| CORS 이슈 | 하 | MCP 서버에서 CORS 허용 필요 |
| 모바일 브라우저 호환성 | 중 | CSS 벤더 프리픽스, 폴리필 검토 |
| 재고 정보 부정확 | 높음 | "참고용" 안내 문구 표시 |

---

## 11. 예상 비용

| 항목 | 비용 | 비고 |
|------|------|------|
| 호스팅 | 무료 | 정적 파일 (GitHub Pages 등) |
| MCP 서버 | 무료 | mcp.aka.page 제공 |
| 도메인 | 무료/유료 | 선택사항 |
| **합계** | **무료** | |

---

*작성일: 2026-03-12*
*최종수정: 2026-03-12*
