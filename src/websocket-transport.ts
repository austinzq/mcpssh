import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { WebSocket } from 'ws';

export class WebSocketTransport implements Transport {
  private ws: WebSocket;
  private _onMessage?: (message: JSONRPCMessage) => void;
  private _onError?: (error: Error) => void;
  private _onClose?: () => void;

  constructor(ws: WebSocket) {
    this.ws = ws;
    
    this.ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as JSONRPCMessage;
        if (this._onMessage) {
          this._onMessage(message);
        }
      } catch (error) {
        if (this._onError) {
          this._onError(new Error(`Failed to parse message: ${error}`));
        }
      }
    });

    this.ws.on('error', (error: Error) => {
      if (this._onError) {
        this._onError(error);
      }
    });

    this.ws.on('close', () => {
      if (this._onClose) {
        this._onClose();
      }
    });
  }

  async start(): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.ws.send(JSON.stringify(message));
  }

  async close(): Promise<void> {
    this.ws.close();
  }

  set onMessage(handler: (message: JSONRPCMessage) => void) {
    this._onMessage = handler;
  }

  set onError(handler: (error: Error) => void) {
    this._onError = handler;
  }

  set onClose(handler: () => void) {
    this._onClose = handler;
  }
}