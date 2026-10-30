import QRCode from "qrcode";

/** QR Code do texto de mentira do PIX, em SVG. Gerado no servidor para a interface só exibir. */
export function gerarQrSvg(texto: string): Promise<string> {
  return QRCode.toString(texto, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}
