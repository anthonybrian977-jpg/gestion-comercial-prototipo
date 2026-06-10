export type NavItem = {
  label: string;
  href: string;
  icon: "dashboard" | "products" | "purchase" | "inventory" | "invoice" | "dispatch";
};

export const mainNavItems: NavItem[] = [
  { label: "Dashboard Gerencial", href: "/", icon: "dashboard" },
  { label: "Maestro de Productos", href: "/productos", icon: "products" },
  { label: "Orden de Compra", href: "/orden-compra", icon: "purchase" },
  { label: "Ingreso de Mercadería", href: "/ingreso-mercaderia", icon: "inventory" },
  { label: "Facturación", href: "/facturacion", icon: "invoice" },
  { label: "Despacho", href: "/despacho", icon: "dispatch" },
];
