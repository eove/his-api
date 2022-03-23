import EventEmitter from 'events';

import { ensureMessage } from './message';

export interface MessageLineParserCreation {
  maxLineLength: number;
}

export enum MessageLineParserEventType {
  message = 'message',
  error = 'error',
}

const endOfLine = '\n';

export class MessageLineParser extends EventEmitter {
  private readonly maxLineLength: number;
  private currentLine: string;

  constructor(creation: MessageLineParserCreation) {
    super();
    const { maxLineLength } = creation;
    this.currentLine = '';
    this.maxLineLength = maxLineLength;
  }

  append(text: string): void {
    const nextLength = this.currentLine.length + text.length;
    if (nextLength > this.maxLineLength) {
      this.emit(
        MessageLineParserEventType.error,
        new Error(`Overflow error (${nextLength} > ${this.maxLineLength})`)
      );
      this.currentLine = '';
      return;
    }
    this.currentLine = this.currentLine + text;
    this.findLine();
  }

  private findLine() {
    const indexOfEol = this.currentLine.indexOf(endOfLine);
    if (indexOfEol === -1) {
      return;
    }
    const line = this.currentLine.substring(0, indexOfEol);
    if (line.length > 0) {
      this.parseAndEmitMessage(line);
    }
    const remaining = this.currentLine.substring(
      indexOfEol + endOfLine.length,
      this.currentLine.length
    );
    this.currentLine = remaining;
    this.findLine();
  }

  private parseAndEmitMessage(text: string): void {
    try {
      const object = this.parseObject(text);
      const message = ensureMessage(object);
      this.emit(MessageLineParserEventType.message, message);
    } catch (error) {
      this.emit(MessageLineParserEventType.error, error);
    }
  }

  private parseObject(text: string): any {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error('Impossible to parse JSON');
    }
  }
}
