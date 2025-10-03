import { Injectable, InternalServerErrorException } from '@nestjs/common';
import fetch from 'node-fetch';

type SendParams = {
  toPhoneE164: string; // número cliente (E.164) ej: +584120000000
  type: 'text'|'image'|'document'|'audio'|'template';
  text?: string;
  mediaUrl?: string;
  template?: { name: string; language: string; components?: any };
};

@Injectable()
export class WaService {
  private baseUrl = 'https://graph.facebook.com/v20.0'; // ajusta versión si es necesario

  async sendMessage(channelPhoneNumberId: string, accessToken: string, params: SendParams) {
    const url = `${this.baseUrl}/${channelPhoneNumberId}/messages`;

    let body: any = { messaging_product: 'whatsapp', to: params.toPhoneE164 };
    if (params.type === 'text') {
      body.type = 'text';
      body.text = { body: params.text };
    } else if (params.type === 'image' || params.type === 'document' || params.type === 'audio') {
      body.type = params.type;
      body[params.type] = { link: params.mediaUrl };
    } else if (params.type === 'template') {
      body.type = 'template';
      body.template = {
        name: params.template!.name,
        language: { code: params.template!.language || 'es' },
        ...(params.template!.components ? { components: params.template!.components } : {})
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new InternalServerErrorException(`WA send error: ${res.status} ${txt}`);
    }
    return res.json(); // contiene message id(s)
  }
}
