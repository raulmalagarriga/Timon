export type ConvStatus =
  | 'nuevo' | 'pendiente' | 'atendiendo' | 'pendiente_pago'
  | 'completado' | 'cerrado' | 'en_espera_cliente';

const transitions: Record<ConvStatus, ConvStatus[]> = {
  nuevo: ['pendiente','atendiendo','cerrado'],
  pendiente: ['atendiendo','pendiente_pago','en_espera_cliente','completado','cerrado'],
  atendiendo: ['pendiente','pendiente_pago','en_espera_cliente','completado','cerrado'],
  pendiente_pago: ['pendiente','atendiendo','completado','cerrado'],
  en_espera_cliente: ['pendiente','atendiendo','cerrado','completado'],
  completado: [],     // terminal
  cerrado: [],        // terminal
};

export function assertTransition(from: ConvStatus, to: ConvStatus) {
  if (from === to) return;
  const allowed = transitions[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Transición inválida: ${from} → ${to}`);
  }
}
