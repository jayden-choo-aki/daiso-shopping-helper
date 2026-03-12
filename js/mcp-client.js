/**
 * 브라우저용 MCP(Model Context Protocol) 클라이언트
 * 다이소 MCP 서버와 JSON-RPC over HTTP + SSE 통신
 */
class McpClient {
  constructor() {
    this.MCP_URL = 'https://mcp.aka.page/mcp';
    this.sessionId = null;
    this.requestId = 0;
    this.initializing = null; // 초기화 중복 방지용 Promise
  }

  /**
   * 다음 JSON-RPC 요청 ID 생성
   */
  _nextId() {
    return ++this.requestId;
  }

  /**
   * SSE 응답 파싱 — event: message\ndata: {...} 형식 처리
   */
  _parseSSE(text) {
    const results = [];
    const events = text.split('\n\n');
    for (const event of events) {
      const lines = event.trim().split('\n');
      let data = null;
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          data = line.slice(6);
        }
      }
      if (data) {
        try {
          results.push(JSON.parse(data));
        } catch (e) {
          // JSON 파싱 실패 시 무시
        }
      }
    }
    return results;
  }

  /**
   * MCP 서버에 JSON-RPC 요청 전송
   */
  async _send(method, params = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream, application/json'
    };

    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
    }

    const body = {
      jsonrpc: '2.0',
      id: this._nextId(),
      method,
      params
    };

    const response = await fetch(this.MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    // 세션 ID 저장
    const newSessionId = response.headers.get('mcp-session-id');
    if (newSessionId) {
      this.sessionId = newSessionId;
    }

    if (!response.ok) {
      throw new Error(`MCP 요청 실패: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      const text = await response.text();
      const parsed = this._parseSSE(text);
      // JSON-RPC result가 있는 응답 반환
      const result = parsed.find(p => p.result !== undefined);
      if (result) return result.result;
      // 에러 응답 확인
      const error = parsed.find(p => p.error !== undefined);
      if (error) throw new Error(error.error.message || 'MCP 도구 호출 실패');
      return parsed[parsed.length - 1];
    } else {
      return await response.json();
    }
  }

  /**
   * MCP 세션 초기화 (initialize → notifications/initialized)
   */
  async initialize() {
    // 이미 초기화 중이면 기존 Promise 반환
    if (this.initializing) return this.initializing;

    this.initializing = (async () => {
      try {
        // 1. initialize
        await this._send('initialize', {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: {
            name: 'daiso-shopping-helper',
            version: '1.0.0'
          }
        });

        // 2. notifications/initialized (id 없는 notification)
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json'
        };
        if (this.sessionId) {
          headers['mcp-session-id'] = this.sessionId;
        }

        await fetch(this.MCP_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/initialized',
            params: {}
          })
        });

        return true;
      } catch (e) {
        this.sessionId = null;
        this.initializing = null;
        throw e;
      }
    })();

    return this.initializing;
  }

  /**
   * MCP 도구 호출 — 세션 없으면 자동 초기화
   */
  async callTool(name, args = {}) {
    // 세션이 없으면 초기화
    if (!this.sessionId) {
      this.initializing = null;
      await this.initialize();
    }

    try {
      const result = await this._send('tools/call', { name, arguments: args });
      return result;
    } catch (e) {
      // 세션 만료 시 재초기화 후 재시도
      if (e.message.includes('401') || e.message.includes('세션') || e.message.includes('session')) {
        this.sessionId = null;
        this.initializing = null;
        await this.initialize();
        return await this._send('tools/call', { name, arguments: args });
      }
      throw e;
    }
  }
}

// 전역 싱글턴 인스턴스
const mcpClient = new McpClient();
