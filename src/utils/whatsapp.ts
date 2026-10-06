export const CONTACT_NUMBERS = [
  { display: '+91 9995592722', value: '919995592722', label: 'Primary Order Desk' },
  { display: '+91 9910396693', value: '919910396693', label: 'Customer Support Desk' }
];

export function createWhatsAppOrderLink(
  productTitle: string,
  price: number,
  selectedSize?: string,
  phoneNumber: string = '919995592722'
): string {
  const sizeText = selectedSize ? ` (Size: ${selectedSize})` : '';
  const message = `Hello Yaarika Collections, I would like to inquire/order: ${productTitle}${sizeText} - Price: ₹${price}`;
  const encodedMsg = encodeURIComponent(message);
  
  // Clean phone string (keep digits only)
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  
  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
}

export function createGeneralWhatsAppLink(phoneNumber: string = '919995592722'): string {
  const message = `Hello Yaarika Collections, I would like to browse your traditional Kerala collection.`;
  const encodedMsg = encodeURIComponent(message);
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
}

export function openWhatsAppLink(url: string): void {
  try {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    window.location.href = url;
  }
}
