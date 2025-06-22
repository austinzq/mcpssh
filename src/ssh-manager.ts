import { Client, ConnectConfig } from 'ssh2';
import SFTPClient from 'ssh2-sftp-client';
import { randomBytes } from 'crypto';
import { readFile } from 'fs/promises';

interface SSHConnection {
  id: string;
  client: Client;
  sftp: SFTPClient;
  host: string;
  port: number;
  username: string;
}

interface ConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export class SSHManager {
  private connections: Map<string, SSHConnection> = new Map();

  async connect(config: ConnectionConfig): Promise<string> {
    const connectionId = randomBytes(16).toString('hex');
    const client = new Client();
    const sftp = new SFTPClient();

    return new Promise((resolve, reject) => {
      client.on('ready', async () => {
        try {
          await sftp.connect({
            host: config.host,
            port: config.port,
            username: config.username,
            password: config.password,
          });

          this.connections.set(connectionId, {
            id: connectionId,
            client,
            sftp,
            host: config.host,
            port: config.port,
            username: config.username,
          });

          resolve(connectionId);
        } catch (error) {
          client.end();
          reject(error);
        }
      });

      client.on('error', (error) => {
        reject(new Error(`SSH connection failed: ${error.message}`));
      });

      const connectConfig: ConnectConfig = {
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        readyTimeout: 30000,
        keepaliveInterval: 10000,
      };

      client.connect(connectConfig);
    });
  }

  async execute(connectionId: string, command: string): Promise<string> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';

      connection.client.exec(command, (err, stream) => {
        if (err) {
          reject(new Error(`Command execution failed: ${err.message}`));
          return;
        }

        stream.on('close', (code: number) => {
          if (code !== 0 && errorOutput) {
            resolve(`Exit code: ${code}\n\nError output:\n${errorOutput}\n\nStandard output:\n${output}`);
          } else {
            resolve(output);
          }
        });

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
      });
    });
  }

  async upload(connectionId: string, localPath: string, remotePath: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    try {
      const fileContent = await readFile(localPath);
      await connection.sftp.put(fileContent, remotePath);
    } catch (error) {
      throw new Error(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async download(connectionId: string, remotePath: string, localPath: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    try {
      await connection.sftp.fastGet(remotePath, localPath);
    } catch (error) {
      throw new Error(`Download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    try {
      await connection.sftp.end();
      connection.client.end();
      this.connections.delete(connectionId);
    } catch (error) {
      this.connections.delete(connectionId);
      throw new Error(`Disconnect failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  listConnections(): Array<{ id: string; host: string; port: number; username: string }> {
    return Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      host: conn.host,
      port: conn.port,
      username: conn.username,
    }));
  }

  async disconnectAll(): Promise<void> {
    const connectionIds = Array.from(this.connections.keys());
    await Promise.all(connectionIds.map(id => this.disconnect(id).catch(() => {})));
  }
}