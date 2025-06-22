declare module 'ssh2-sftp-client' {
  import { ConnectConfig } from 'ssh2';

  export default class SFTPClient {
    connect(config: ConnectConfig): Promise<void>;
    put(data: Buffer | string | NodeJS.ReadableStream, remotePath: string, options?: any): Promise<void>;
    fastGet(remotePath: string, localPath: string, options?: any): Promise<void>;
    end(): Promise<void>;
    on(event: string, callback: Function): void;
  }
}