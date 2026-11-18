import {
  LayoutGrid, MapPin, Sprout, ShieldCheck, Package,
  Truck, Receipt, QrCode, Settings2, BellRing, Warehouse, FlaskConical, ClipboardList,
} from 'lucide-vue-next'

export const NAV = [
  {
    group: '作业',
    items: [
      { key: 'dashboard', label: '概览', icon: LayoutGrid, to: '/dashboard' },
      { key: 'farm', label: '基地', icon: MapPin, to: '/farm' },
      { key: 'produce', label: '生产', icon: Sprout, to: '/produce' },
      { key: 'inputs', label: '农资', icon: FlaskConical, to: '/inputs' },
      { key: 'warehouse', label: '仓储', icon: Warehouse, to: '/warehouse' },
      { key: 'inspect', label: '质检', icon: ShieldCheck, to: '/inspect' },
      { key: 'alerts', label: '预警', icon: BellRing, to: '/alerts' },
    ],
  },
  {
    group: '流通',
    items: [
      { key: 'codes', label: '赋码', icon: QrCode, to: '/codes' },
      { key: 'ship', label: '物流', icon: Truck, to: '/ship' },
      { key: 'orders', label: '订单', icon: ClipboardList, to: '/orders' },
      { key: 'sale', label: '销售', icon: Receipt, to: '/sale' },
      { key: 'trace', label: '追溯', icon: Package, to: '/trace' },
    ],
  },
]

export const FOOT_NAV = { key: 'sys', label: '系统', icon: Settings2, to: '/sys' }