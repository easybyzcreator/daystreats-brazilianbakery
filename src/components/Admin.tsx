import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, 
  query, orderBy, serverTimestamp, writeBatch 
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { Product, Order, Settings, Category, Side, ImageGallery } from '../types';
import { 
  Settings as SettingsIcon, Package, History, LogOut, Plus, Trash2, Edit2, 
  Save, X, Copy, CheckCircle2, Loader2, Layers, Image as ImageIcon,
  ArrowUp, ArrowDown, ArrowUpDown, ChevronsUp, ChevronsDown, ListOrdered,
  MessageCircle, MessageSquare, Calendar, Printer, Cake, Eye, EyeOff,
  DollarSign, Coins, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Clock, Users, Download, Truck, Search, Filter,
  ShieldCheck, RotateCcw, Rocket, MapPin, Store
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const getContrastText = (hexColor?: string): string => {
  if (!hexColor) return '#ffffff';
  let hex = hexColor.trim();
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const hsp = Math.sqrt(
    0.299 * (r * r) +
    0.587 * (g * g) +
    0.114 * (b * b)
  );
  return hsp > 155 ? '#000000' : '#ffffff';
};

const getColorWithLegibility = (hexColor?: string, defaultColor: string = '#865d39'): string => {
  if (!hexColor) return defaultColor;
  let hex = hexColor.trim();
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  if (hex.length !== 6) return defaultColor;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance > 0.6) {
    return defaultColor;
  }
  return `#${hex}`;
};

export default function Admin({ settings, setSettings, setIsAdmin }: { 
  settings: Settings, 
  setSettings: React.Dispatch<React.SetStateAction<Settings>>,
  setIsAdmin: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [galleryIdToDelete, setGalleryIdToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'menu' | 'orders' | 'categories' | 'sides' | 'customers' | 'cakeOptions' | 'galleries' | 'reorderProducts'>('orders');
  const [categoryCatalogFilter, setCategoryCatalogFilter] = useState<'all' | 'catalog1' | 'catalog2' | 'catalog3' | 'shared'>('all');
  const [reorderCatalogFilter, setReorderCatalogFilter] = useState<'all' | 'catalog1' | 'catalog2' | 'catalog3'>('all');
  const [reorderSelectedCategory, setReorderSelectedCategory] = useState<string>('all');
  const [reorderSearchQuery, setReorderSearchQuery] = useState<string>('');
  const [isSavingProductOrder, setIsSavingProductOrder] = useState<boolean>(false);
  const [galleries, setGalleries] = useState<ImageGallery[]>([]);
  const [sides, setSides] = useState<Side[]>([]);
  const [newSide, setNewSide] = useState<Partial<Side>>({ name: '', price: 0, type: 'side' });
  const [isEditingSide, setIsEditingSide] = useState<Side | null>(null);
  const [sidePriceInput, setSidePriceInput] = useState('');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [isEditingProduct, setIsEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Omit<Product, 'id'>>({
    title: '',
    description: '',
    price: 0,
    oldPrice: 0,
    priceType: 'fixed',
    image: '',
    categoryId: '',
    isMeal: true,
    isCustomCake: false,
    isCustomSandwich: false,
    customFillings: '',
    ingredients: '',
    allowedSides: [],
    isActive: true,
    hasSizes: false,
    sizes: [],
    cakeGalleryId: ''
  });
  const [priceInput, setPriceInput] = useState('');
  const [sizeForm, setSizeForm] = useState({ name: '', price: '', oldPrice: '' });
  const [editingSizeId, setEditingSizeId] = useState<string | null>(null);

  const [isEditingCategory, setIsEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState({ title: '', order: 0, catalog: 'both' as 'catalog1' | 'catalog2' | 'catalog3' | 'both' | 'all' | 'catalog_b2b' });

  const [copied, setCopied] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedHistoryCatalog, setSelectedHistoryCatalog] = useState<'all' | 'catalog1' | 'catalog2' | 'catalog3'>('all');
  const [orderTypeTab, setOrderTypeTab] = useState<'retail' | 'b2b'>('retail');
  const [customerSearch, setCustomerSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showBirthdaysOnly, setShowBirthdaysOnly] = useState(false);
  const [showBatchSummary, setShowBatchSummary] = useState(false);
  const [isEditingOrder, setIsEditingOrder] = useState<Order | null>(null);
  const [isEditingCustomer, setIsEditingCustomer] = useState<any | null>(null);
  const [viewingCustomerOrders, setViewingCustomerOrders] = useState<any | null>(null);
  const [editCustomerForm, setEditCustomerForm] = useState<any>({});
  const [editOrderForm, setEditOrderForm] = useState<Partial<Order>>({});
  const [selectedProductId, setSelectedProductId] = useState('');
  const [addItemQuantity, setAddItemQuantity] = useState(1);

  // Manual Order Creation State
  const [isCreatingManualOrder, setIsCreatingManualOrder] = useState(false);
  const [manualOrderForm, setManualOrderForm] = useState<{
    customerName: string;
    phone: string;
    email: string;
    birthday: string;
    fulfillmentType: 'pickup' | 'delivery';
    scheduledDate: string;
    scheduledTime: string;
    address: string;
    street: string;
    number: string;
    city: string;
    zipCode: string;
    observation: string;
    items: Array<{
      title: string;
      quantity: number;
      price: number;
      selectedSize?: any;
    }>;
    isB2B: boolean;
    b2bCompanyName: string;
    b2bManagerName: string;
    applyTax: boolean;
    taxRate: number;
    totalOverride: string;
    paymentStatus: 'nao_pago' | '50_sinal' | 'pago_100';
    productionStatus: 'pendente' | 'validado';
    deliveryStatus: 'a_entregar' | 'entregue';
  }>({
    customerName: '',
    phone: '',
    email: '',
    birthday: '',
    fulfillmentType: 'pickup',
    scheduledDate: '',
    scheduledTime: '12:00 PM',
    paymentStatus: 'nao_pago',
    productionStatus: 'pendente',
    deliveryStatus: 'a_entregar',
    address: '',
    street: '',
    number: '',
    city: '',
    zipCode: '',
    observation: '',
    items: [],
    isB2B: false,
    b2bCompanyName: '',
    b2bManagerName: '',
    applyTax: false,
    taxRate: 8.25,
    totalOverride: ''
  });
  const [manualSelectedProductId, setManualSelectedProductId] = useState('');
  const [manualSelectedSizeId, setManualSelectedSizeId] = useState('');
  const [manualItemQuantity, setManualItemQuantity] = useState(1);
  const [manualCustomTitle, setManualCustomTitle] = useState('');
  const [manualCustomPrice, setManualCustomPrice] = useState('');

  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [calendarViewMode, setCalendarViewMode] = useState<'weekly-grid' | 'weekly-agenda' | 'monthly'>('weekly-grid');
  const [selectedCalendarOrder, setSelectedCalendarOrder] = useState<Order | null>(null);

  const formatDateToISO = (d: Date): string => {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getOrderDateISO = (order: Order): string | null => {
    let raw = order.scheduledDate;
    if (!raw && order.pickupDate) {
      raw = order.pickupDate.split(' at ')[0]?.trim();
    }
    if (!raw) return null;
    raw = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const slashParts = raw.split('/');
    if (slashParts.length === 3) {
      if (slashParts[2].length === 4) {
        const p1 = parseInt(slashParts[0], 10);
        const p2 = parseInt(slashParts[1], 10);
        const y = slashParts[2];
        if (p1 > 12) {
          return `${y}-${p2.toString().padStart(2, '0')}-${p1.toString().padStart(2, '0')}`;
        } else {
          return `${y}-${p1.toString().padStart(2, '0')}-${p2.toString().padStart(2, '0')}`;
        }
      }
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return formatDateToISO(d);
    }
    return null;
  };

  const getOrderTime = (order: Order): string => {
    if (order.scheduledTime) return order.scheduledTime;
    if (order.pickupDate && order.pickupDate.includes(' at ')) {
      return order.pickupDate.split(' at ')[1]?.trim() || '';
    }
    return '';
  };

  const jumpToOrderDate = (order: Order) => {
    const oDateStr = getOrderDateISO(order);
    if (oDateStr) {
      const parts = oDateStr.split('-');
      if (parts.length === 3) {
        const targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        targetDate.setHours(0, 0, 0, 0);
        setCurrentCalendarDate(targetDate);
        setSelectedCalendarOrder(order);
        const cal = document.getElementById('admin-calendar-section');
        if (cal) {
          cal.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        toast.success(`Navegado para a data: ${oDateStr}`);
      }
    } else {
      toast.error('Este pedido não possui uma data agendada válida.');
    }
  };

  const updateOrderFormWithItems = (updatedItems: any[]) => {
    const isCorp = editOrderForm.isB2B || editOrderForm.isPJ;
    const subtotalVal = updatedItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
    if (isCorp) {
      setEditOrderForm({
        ...editOrderForm,
        items: updatedItems,
        total: subtotalVal,
        subtotal: subtotalVal,
        taxRate: 0,
        taxAmount: 0
      });
    } else {
      const taxAmountVal = subtotalVal * 0.0825;
      const totalWithTaxVal = subtotalVal + taxAmountVal;
      setEditOrderForm({
        ...editOrderForm,
        items: updatedItems,
        total: totalWithTaxVal,
        subtotal: subtotalVal,
        taxRate: 8.25,
        taxAmount: taxAmountVal
      });
    }
  };
  const [oldPriceInput, setOldPriceInput] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const [isEditingPopupDateTime, setIsEditingPopupDateTime] = useState(false);
  const [popupEditDate, setPopupEditDate] = useState('');
  const [popupEditTime, setPopupEditTime] = useState('');
  const [popupEditFulfillment, setPopupEditFulfillment] = useState<'pickup' | 'delivery'>('pickup');
  const [isSavingPopupDateTime, setIsSavingPopupDateTime] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const uniqueCustomers = useMemo(() => {
    const customerMap = new Map<string, {
      name: string;
      phone: string;
      email: string;
      birthday: string;
      address: string;
      orderLanguage?: string;
      lastOrder: any;
      totalOrders: number;
      isB2B: boolean;
      managerName: string;
      street: string;
      number: string;
      zipCode: string;
      city: string;
      frequency: string;
      orders: Order[];
    }>();

    orders.forEach(order => {
      const isCorp = !!(order.isB2B || order.isPJ);
      const name = isCorp ? (order.b2bCompanyName || order.customerName) : order.customerName;
      const phone = order.phone || '';
      const email = order.email || '';
      const key = phone || email || name;
      if (!key) return;

      if (!customerMap.has(key)) {
        customerMap.set(key, {
          name: name,
          phone: phone,
          email: email,
          birthday: order.birthday || '',
          address: isCorp ? (order.b2bAddress || order.address || '') : (order.address || ''),
          orderLanguage: order.orderLanguage,
          lastOrder: order.createdAt,
          totalOrders: 1,
          isB2B: isCorp,
          managerName: order.b2bManagerName || '',
          street: order.street || '',
          number: order.number || '',
          zipCode: isCorp ? (order.b2bZipCode || order.zipCode || '') : (order.zipCode || ''),
          city: isCorp ? (order.b2bCity || order.city || '') : (order.city || ''),
          frequency: order.b2bFrequency || '',
          orders: [order]
        });
      } else {
        const existing = customerMap.get(key)!;
        existing.totalOrders += 1;
        existing.orders.push(order);
        if (isCorp) {
          existing.isB2B = true;
          if (order.b2bCompanyName) existing.name = order.b2bCompanyName;
          if (order.b2bManagerName) existing.managerName = order.b2bManagerName;
          if (order.b2bAddress) existing.address = order.b2bAddress;
          if (order.b2bZipCode) existing.zipCode = order.b2bZipCode;
          if (order.b2bCity) existing.city = order.b2bCity;
          if (order.b2bFrequency) existing.frequency = order.b2bFrequency;
        } else {
          if (order.street) existing.street = order.street;
          if (order.number) existing.number = order.number;
          if (order.zipCode) existing.zipCode = order.zipCode;
          if (order.city) existing.city = order.city;
        }
        if (order.createdAt?.toDate && existing.lastOrder?.toDate) {
          if (order.createdAt.toDate() > existing.lastOrder.toDate()) {
            existing.lastOrder = order.createdAt;
            if (!isCorp) {
              existing.name = order.customerName;
              existing.birthday = order.birthday || existing.birthday;
              existing.address = order.address || existing.address;
            }
            existing.orderLanguage = order.orderLanguage || existing.orderLanguage;
          }
        }
      }
    });

    return Array.from(customerMap.values());
  }, [orders]);

  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-');
  };

  const handleBrandNameChange = (name: string) => {
    setSettings(prev => ({
      ...prev,
      brandName: name,
      slug: slugify(name)
    }));
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);

    const unsubProducts = onSnapshot(query(collection(db, 'produtos'), orderBy('title')), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    });

    const unsubCategories = onSnapshot(query(collection(db, 'categorias'), orderBy('order', 'asc')), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    });

    const unsubOrders = onSnapshot(query(collection(db, 'pedidos'), orderBy('createdAt', 'desc')), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    const unsubSides = onSnapshot(collection(db, 'acompanhamentos'), (snapshot) => {
      setSides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Side)));
    });

    const unsubGalleries = onSnapshot(collection(db, 'galerias'), (snapshot) => {
      setGalleries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ImageGallery)));
    });

    return () => {
      unsubProducts();
      unsubCategories();
      unsubOrders();
      unsubSides();
      unsubGalleries();
    };
  }, [isLoggedIn]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = settings?.adminPassword || 'admin123';
    if (password === correctPassword) {
      try {
        await signInAnonymously(auth);
        setIsLoggedIn(true);
        toast.success('Login realizado com sucesso!');
      } catch (error) {
        console.error('Erro ao autenticar com Firebase:', error);
        toast.error('Erro ao conectar com o servidor. Tente novamente.');
      }
    } else {
      toast.error('Senha incorreta!');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void, isGallery: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      // Compress image if it's too large
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimensions - smaller for gallery to save space in Firestore
          const MAX_WIDTH = isGallery ? 800 : 1200;
          const MAX_HEIGHT = isGallery ? 800 : 1200;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Quality 0.7 for good balance, 0.5 for gallery
          const compressedBase64 = canvas.toDataURL('image/jpeg', isGallery ? 0.5 : 0.7);
          callback(compressedBase64);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const addCakeOptionItem = (key: 'cakeSizes' | 'cakeDoughs' | 'cakeFillings' | 'cakeToppings' | 'cakeToppers', defaultValue: string = '') => {
    setSettings(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), defaultValue]
    }));
  };

  const removeCakeOptionItem = (key: 'cakeSizes' | 'cakeDoughs' | 'cakeFillings' | 'cakeToppings' | 'cakeToppers', index: number) => {
    setSettings(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter((_: any, i: number) => i !== index)
    }));
  };

  const updateCakeOptionItem = (key: 'cakeSizes' | 'cakeDoughs' | 'cakeFillings' | 'cakeToppings' | 'cakeToppers', index: number, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: (prev[key] || []).map((v: string, i: number) => i === index ? value : v)
    }));
  };

  const saveSettings = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );
      
      const updatedSettings = {
        ...settings,
        language: 'en' as const,
        currency: 'USD' as const
      };
      
      await Promise.race([
        setDoc(doc(db, 'configuracoes', 'geral'), updatedSettings),
        timeoutPromise
      ]);
      
      toast.success('Configurações salvas com sucesso!');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      toast.error('Erro ao salvar configurações. Verifique sua conexão ou o tamanho das imagens.');
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  };

  const handlePriceChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      setPriceInput('0,00');
      setNewProduct(prev => ({ ...prev, price: 0 }));
      return;
    }
    
    const numericValue = parseInt(digits) / 100;
    const formatted = numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    setPriceInput(formatted);
    setNewProduct(prev => ({ ...prev, price: numericValue }));
  };

  const handleOldPriceChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      setOldPriceInput('0,00');
      setNewProduct(prev => ({ ...prev, oldPrice: 0 }));
      return;
    }
    
    const numericValue = parseInt(digits) / 100;
    const formatted = numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    setOldPriceInput(formatted);
    setNewProduct(prev => ({ ...prev, oldPrice: numericValue }));
  };

  const handleAddSizeOption = () => {
    if (!sizeForm.name) {
      toast.error('Informe ao menos o nome do tamanho.');
      return;
    }
    const priceVal = sizeForm.price ? (parseFloat(sizeForm.price.replace(/\D/g, '')) / 100) : 0;
    
    if (editingSizeId) {
      setNewProduct((prev: any) => ({
        ...prev,
        sizes: (prev.sizes || []).map((s: any) => 
          s.id === editingSizeId ? { ...s, name: sizeForm.name, price: priceVal } : s
        )
      }));
      setEditingSizeId(null);
      setSizeForm({ name: '', price: '', oldPrice: '' });
      toast.success('Opção de tamanho atualizada!');
    } else {
      const newSizeOption = {
        id: Math.random().toString(36).substr(2, 9),
        name: sizeForm.name,
        price: priceVal
      };
      
      setNewProduct((prev: any) => ({
        ...prev,
        sizes: [...(prev.sizes || []), newSizeOption]
      }));
      
      setSizeForm({ name: '', price: '', oldPrice: '' });
      toast.success('Opção de tamanho adicionada!');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!newProduct.title || !newProduct.categoryId) {
        toast.error('Por favor, preencha o título e a categoria.');
        return;
      }

      if (isEditingProduct) {
        await updateDoc(doc(db, 'produtos', isEditingProduct.id), newProduct);
        setIsEditingProduct(null);
        toast.success('Produto atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'produtos'), { ...newProduct, isActive: true });
        toast.success('Produto adicionado com sucesso!');
      }
      setNewProduct({ 
        title: '', 
        description: '', 
        price: 0, 
        priceType: 'fixed',
        image: '', 
        categoryId: '',
        isMeal: true,
        isCustomCake: false,
        isCustomSandwich: false,
        customFillings: '',
        ingredients: '',
        allowedSides: [],
        isActive: true,
        oldPrice: 0,
        hasSizes: false,
        sizes: [],
        cakeGalleryId: ''
      });
      setPriceInput('');
      setOldPriceInput('');
      setEditingSizeId(null);
      setSizeForm({ name: '', price: '', oldPrice: '' });
    } catch (err) {
      toast.error('Erro ao salvar produto.');
    }
  };

  const toggleProductStatus = async (product: Product) => {
    try {
      await updateDoc(doc(db, 'produtos', product.id), {
        isActive: product.isActive === false ? true : false
      });
    } catch (err) {
      alert('Erro ao alterar status do produto.');
    }
  };

  const moveCategory = async (id: string, direction: 'up' | 'down') => {
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === categories.length - 1) return;

    const otherIndex = direction === 'up' ? index - 1 : index + 1;
    const current = categories[index];
    const other = categories[otherIndex];

    const currentOrder = current.order ?? index;
    const otherOrder = other.order ?? otherIndex;

    let newCurrentOrder = otherOrder;
    let newOtherOrder = currentOrder;

    if (newCurrentOrder === newOtherOrder) {
      if (direction === 'up') {
        newCurrentOrder = newOtherOrder - 1;
      } else {
        newCurrentOrder = newOtherOrder + 1;
      }
    }

    await updateDoc(doc(db, 'categorias', current.id), { order: newCurrentOrder });
    await updateDoc(doc(db, 'categorias', other.id), { order: newOtherOrder });
  };

  const moveCategoryInCatalog = async (id: string, direction: 'up' | 'down', list: Category[]) => {
    const index = list.findIndex(c => c.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === list.length - 1) return;

    const otherIndex = direction === 'up' ? index - 1 : index + 1;
    const current = list[index];
    const other = list[otherIndex];

    const currentOrder = current.order ?? index;
    const otherOrder = other.order ?? otherIndex;

    let newCurrentOrder = otherOrder;
    let newOtherOrder = currentOrder;

    if (newCurrentOrder === newOtherOrder) {
      if (direction === 'up') {
        newCurrentOrder = newOtherOrder - 1;
      } else {
        newCurrentOrder = newOtherOrder + 1;
      }
    }

    try {
      await updateDoc(doc(db, 'categorias', current.id), { order: newCurrentOrder });
      await updateDoc(doc(db, 'categorias', other.id), { order: newOtherOrder });
      toast.success('Ordem da categoria atualizada!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao mover categoria.');
    }
  };

  const moveProductInCategory = async (categoryId: string, productId: string, direction: 'up' | 'down') => {
    try {
      setIsSavingProductOrder(true);
      const catProducts = products
        .filter(p => p.categoryId === categoryId)
        .sort((a, b) => {
          const orderA = typeof a.order === 'number' ? a.order : 9999;
          const orderB = typeof b.order === 'number' ? b.order : 9999;
          if (orderA !== orderB) return orderA - orderB;
          return a.title.localeCompare(b.title);
        });

      const currentIndex = catProducts.findIndex(p => p.id === productId);
      if (currentIndex === -1) return;
      if (direction === 'up' && currentIndex === 0) return;
      if (direction === 'down' && currentIndex === catProducts.length - 1) return;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const reorderedList = [...catProducts];
      const [movedItem] = reorderedList.splice(currentIndex, 1);
      reorderedList.splice(targetIndex, 0, movedItem);

      const batch = writeBatch(db);
      reorderedList.forEach((prod, idx) => {
        batch.update(doc(db, 'produtos', prod.id), { order: idx });
      });

      await batch.commit();
      toast.success('Ordem do produto atualizada!');
    } catch (err) {
      console.error('Erro ao reordenar produto:', err);
      toast.error('Erro ao salvar ordem do produto.');
    } finally {
      setIsSavingProductOrder(false);
    }
  };

  const moveProductToExtreme = async (categoryId: string, productId: string, position: 'top' | 'bottom') => {
    try {
      setIsSavingProductOrder(true);
      const catProducts = products
        .filter(p => p.categoryId === categoryId)
        .sort((a, b) => {
          const orderA = typeof a.order === 'number' ? a.order : 9999;
          const orderB = typeof b.order === 'number' ? b.order : 9999;
          if (orderA !== orderB) return orderA - orderB;
          return a.title.localeCompare(b.title);
        });

      const currentIndex = catProducts.findIndex(p => p.id === productId);
      if (currentIndex === -1) return;
      if (position === 'top' && currentIndex === 0) return;
      if (position === 'bottom' && currentIndex === catProducts.length - 1) return;

      const reorderedList = [...catProducts];
      const [movedItem] = reorderedList.splice(currentIndex, 1);
      if (position === 'top') {
        reorderedList.unshift(movedItem);
      } else {
        reorderedList.push(movedItem);
      }

      const batch = writeBatch(db);
      reorderedList.forEach((prod, idx) => {
        batch.update(doc(db, 'produtos', prod.id), { order: idx });
      });

      await batch.commit();
      toast.success(position === 'top' ? 'Produto movido para o topo!' : 'Produto movido para o fim!');
    } catch (err) {
      console.error('Erro ao mover produto:', err);
      toast.error('Erro ao salvar nova posição.');
    } finally {
      setIsSavingProductOrder(false);
    }
  };

  const handleAddSide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSide.name) return;

    try {
      if (isEditingSide) {
        await updateDoc(doc(db, 'acompanhamentos', isEditingSide.id), newSide);
        toast.success('Acompanhamento atualizado!');
      } else {
        await addDoc(collection(db, 'acompanhamentos'), newSide);
        toast.success('Acompanhamento adicionado!');
      }
      setNewSide({ name: '', price: 0, type: 'side' });
      setSidePriceInput('');
      setIsEditingSide(null);
    } catch (error) {
      console.error('Error adding side:', error);
      toast.error('Erro ao salvar acompanhamento');
    }
  };

  const deleteSide = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Acompanhamento',
      message: 'Tem certeza que deseja excluir este acompanhamento?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'acompanhamentos', id));
          toast.success('Acompanhamento excluído!');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          toast.error('Erro ao excluir');
        }
      }
    });
  };

  const handleSidePriceChange = (val: string) => {
    setSidePriceInput(val);
    const numeric = parseFloat(val.replace(',', '.'));
    if (!isNaN(numeric)) {
      setNewSide({ ...newSide, price: numeric });
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!newCategory.title) {
        toast.error('Por favor, preencha o título da categoria.');
        return;
      }

      if (isEditingCategory) {
        await updateDoc(doc(db, 'categorias', isEditingCategory.id), { 
          title: newCategory.title,
          catalog: newCategory.catalog || 'both'
        });
        setIsEditingCategory(null);
        toast.success('Categoria atualizada com sucesso!');
      } else {
        const maxOrder = categories.reduce((max, c) => Math.max(max, c.order || 0), 0);
        await addDoc(collection(db, 'categorias'), {
          title: newCategory.title,
          order: maxOrder + 1,
          catalog: newCategory.catalog || 'both'
        });
        toast.success('Categoria adicionada com sucesso!');
      }
      setNewCategory({ title: '', order: 0, catalog: 'both' });
    } catch (err: any) {
      console.error('Erro ao salvar categoria:', err);
      if (err.message?.includes('permission-denied')) {
        toast.error('Erro de permissão: Você não tem autorização para salvar. Verifique se está logado corretamente.');
      } else {
        toast.error('Erro ao salvar categoria. Verifique sua conexão.');
      }
    }
  };

  const deleteProduct = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Produto',
      message: 'Deseja realmente excluir este produto? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'produtos', id));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          alert('Erro ao excluir produto.');
        }
      }
    });
  };

  const deleteCategory = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Categoria',
      message: 'Deseja realmente excluir esta categoria? Todos os produtos vinculados a ela ficarão sem categoria.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'categorias', id));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          alert('Erro ao excluir categoria.');
        }
      }
    });
  };

  const deleteOrder = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Pedido',
      message: 'Deseja realmente excluir este pedido do histórico?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'pedidos', id));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          alert('Erro ao excluir pedido.');
        }
      }
    });
  };

  const deleteCustomer = async (customer: any) => {
    const customerId = customer.phone || customer.email || customer.name;
    const customerOrders = orders.filter(o => (o.phone || o.email || o.customerName) === customerId);
    
    try {
      setIsSaving(true);
      for (const order of customerOrders) {
        await deleteDoc(doc(db, 'pedidos', order.id));
      }
      toast.success('Cliente e seus pedidos excluídos com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast.error('Erro ao excluir cliente');
    } finally {
      setIsSaving(false);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const updateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const originalId = isEditingCustomer.phone || isEditingCustomer.email || isEditingCustomer.name;
    const customerOrders = orders.filter(o => {
      const isCorp = o.isB2B || o.isPJ;
      const oName = isCorp ? (o.b2bCompanyName || o.customerName) : o.customerName;
      const oKey = o.phone || o.email || oName;
      return oKey === originalId;
    });

    try {
      setIsSaving(true);
      for (const order of customerOrders) {
        const updateData: any = {
          phone: editCustomerForm.phone,
          email: editCustomerForm.email,
          birthday: editCustomerForm.birthday || '',
        };

        if (editCustomerForm.isB2B) {
          updateData.b2bCompanyName = editCustomerForm.name;
          updateData.b2bManagerName = editCustomerForm.managerName || '';
          updateData.b2bAddress = editCustomerForm.address || '';
          updateData.b2bZipCode = editCustomerForm.zipCode || '';
          updateData.b2bCity = editCustomerForm.city || '';
          updateData.b2bFrequency = editCustomerForm.frequency || '';
          // Keep customerName in sync for fallback
          updateData.customerName = editCustomerForm.managerName || editCustomerForm.name;
          updateData.address = editCustomerForm.address || '';
        } else {
          updateData.customerName = editCustomerForm.name;
          updateData.street = editCustomerForm.street || '';
          updateData.number = editCustomerForm.number || '';
          updateData.zipCode = editCustomerForm.zipCode || '';
          updateData.city = editCustomerForm.city || '';
          
          // Rebuild full address from components
          const fullAddr = `${editCustomerForm.street || ''}, ${editCustomerForm.number || 'S/N'} - ${editCustomerForm.city || ''} (${editCustomerForm.zipCode || ''})`;
          updateData.address = fullAddr;
        }

        await updateDoc(doc(db, 'pedidos', order.id), updateData);
      }
      toast.success('Informações do cliente atualizadas!');
      setIsEditingCustomer(null);
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      toast.error('Erro ao atualizar cliente');
    } finally {
      setIsSaving(false);
    }
  };

  const closestUpcomingOrder = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseDateString = (str: string, lang?: string) => {
      if (!str || !str.includes('/')) return null;
      const parts = str.split('/');
      if (parts.length !== 3) return null;
      
      let month = parseInt(parts[0]);
      let day = parseInt(parts[1]);
      let year = parseInt(parts[2]);

      // Always treat as MM/DD/YYYY by default (USA pattern), but if the first part (month) is > 12, it is definitely DD/MM/YYYY
      if (month > 12) {
        day = parseInt(parts[0]);
        month = parseInt(parts[1]);
      }
      
      if (!day || !month || !year || month > 12) return null;
      return new Date(year, month - 1, day);
    };

    const upcomingOrders = orders
      .map(o => {
        if (!o.pickupDate) return null;
        const d = parseDateString(o.pickupDate, o.orderLanguage || settings.language || 'pt');
        if (!d) return null;
        d.setHours(0, 0, 0, 0);
        return { order: o, date: d };
      })
      .filter((item): item is { order: Order; date: Date } => item !== null && item.date >= today);

    if (upcomingOrders.length === 0) {
      // If none are in the future, get the closest one overall that has a pickupDate
      const allWithDate = orders
        .map(o => {
          if (!o.pickupDate) return null;
          const d = parseDateString(o.pickupDate, o.orderLanguage || settings.language || 'pt');
          if (!d) return null;
          d.setHours(0, 0, 0, 0);
          return { order: o, date: d };
        })
        .filter((item): item is { order: Order; date: Date } => item !== null);
      
      if (allWithDate.length === 0) return null;
      
      allWithDate.sort((a, b) => b.date.getTime() - a.date.getTime());
      return allWithDate[0].order;
    }

    upcomingOrders.sort((a, b) => a.date.getTime() - b.date.getTime());
    return upcomingOrders[0].order;
  }, [orders, settings.language]);

  const printWithIframe = (htmlContent: string) => {
    let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
    if (iframe) {
      document.body.removeChild(iframe);
    }

    iframe = document.createElement('iframe');
    iframe.id = 'print-iframe';
    iframe.setAttribute('style', 'position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0;');
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) return;

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    setTimeout(() => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    }, 250);
  };

  const printOrdersList = () => {
    const listTitle = orderTypeTab === 'b2b' 
      ? 'PEDIDOS CORPORATIVOS (B2B)' 
      : 'PEDIDOS VAREJO (RETAIL)';

    const contentHtml = filteredOrders.map((order, index) => {
      const itemsText = order.items.map(item => `  ${item.quantity}x ${item.title}${item.selectedSize ? ` (${item.selectedSize.name})` : ''}`).join('\n');
      const name = order.isB2B || order.isPJ ? (order.b2bCompanyName || order.customerName) : order.customerName;
      const deliveryDate = order.pickupDate ? order.pickupDate : 'N/A';
      
      return `
        <div class="order-block">
          <div class="order-header">#${index + 1} - ${name.toUpperCase()}</div>
          <div class="order-details">
            TEL: ${order.phone}<br/>
            ENTREGA: ${deliveryDate}
          </div>
          <div class="order-items">${itemsText}</div>
          <div class="order-total">TOTAL: ${currencySymbol} ${order.total.toFixed(2).replace('.', ',')}</div>
        </div>
      `;
    }).join('');

    const totalSum = filteredOrders.reduce((sum, o) => sum + o.total, 0);

    printWithIframe(`
      <html>
        <head>
          <title>${listTitle}</title>
          <style>
            @page { size: auto; margin: 20mm; }
            body { 
              font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              width: 100%; 
              max-width: 170mm; 
              margin: 0 auto; 
              padding: 0; 
              font-size: 14px; 
              color: #111; 
              line-height: 1.5; 
            }
            .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 15px; margin-bottom: 25px; }
            .header h1 { font-size: 24px; margin: 0 0 5px 0; text-transform: uppercase; font-weight: 800; letter-spacing: -0.5px; }
            .header p { font-size: 13px; margin: 3px 0; color: #666; font-weight: 500; }
            .order-block { margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
            .order-header { font-weight: 700; font-size: 16px; color: #000; margin-bottom: 5px; }
            .order-details { font-size: 13px; margin: 4px 0; color: #555; line-height: 1.4; }
            .order-items { white-space: pre-wrap; font-family: monospace; font-size: 13px; margin: 8px 0; background: #f9f9f9; padding: 12px; border-radius: 6px; border: 1px solid #eee; line-height: 1.4; }
            .order-total { text-align: right; font-weight: 700; font-size: 14px; color: #000; }
            .total-sum { font-size: 18px; font-weight: 800; text-align: right; border-top: 2px solid #111; padding-top: 15px; margin-top: 25px; text-transform: uppercase; color: #000; }
            @media print {
              body { width: 100%; max-width: 100%; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${listTitle}</h1>
            <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
            <p>Total de Pedidos: ${filteredOrders.length}</p>
          </div>
          ${contentHtml || '<div style="text-align: center; padding: 15px; color: #666;">Nenhum pedido encontrado.</div>'}
          <div class="total-sum">
            SOMA TOTAL: ${currencySymbol} ${totalSum.toFixed(2).replace('.', ',')}
          </div>
        </body>
      </html>
    `);
  };

  const printAllProductsList = () => {
    const groupedProducts = categories.map(cat => {
      const catProducts = products.filter(p => p.categoryId === cat.id);
      return {
        categoryTitle: cat.title,
        products: catProducts
      };
    }).filter(group => group.products.length > 0);

    const uncategorizedProducts = products.filter(p => !p.categoryId || !categories.some(cat => cat.id === p.categoryId));
    if (uncategorizedProducts.length > 0) {
      groupedProducts.push({
        categoryTitle: 'Sem Categoria',
        products: uncategorizedProducts
      });
    }

    const contentHtml = groupedProducts.map(group => {
      const productsHtml = group.products.map((product, idx) => {
        let priceStr = '';
        if (product.hasSizes && product.sizes && product.sizes.length > 0) {
          priceStr = product.sizes.map(s => `  - ${s.name}: ${currencySymbol} ${Number(s.price).toFixed(2).replace('.', ',')}`).join('\n');
        } else {
          priceStr = `  ${currencySymbol} ${Number(product.price || 0).toFixed(2).replace('.', ',')}`;
          if (product.oldPrice) {
            priceStr += ` (De: ${currencySymbol} ${Number(product.oldPrice).toFixed(2).replace('.', ',')})`;
          }
        }

        let catalogLabel = '';
        if (product.catalog === 'catalog1') {
          catalogLabel = settings?.catalog1Title || 'Cardápio 1';
        } else if (product.catalog === 'catalog2') {
          catalogLabel = settings?.catalog2Title || 'Cardápio 2';
        } else if (product.catalog === 'catalog3') {
          catalogLabel = settings?.catalog3Title || 'Cardápio 3';
        } else if (product.catalog === 'all') {
          catalogLabel = 'Todos os Cardápios';
        }

        const activeStatusText = product.isActive !== false ? 'ATIVO' : 'INATIVO';

        const fillingsHtml = product.isCustomSandwich && product.customFillings ? `
          <div class="product-desc" style="font-weight: 500; color: #444; margin-top: 4px;">
            <strong>Recheios Disponíveis:</strong> ${product.customFillings}
          </div>
        ` : '';

        const ingredientsHtml = product.ingredients ? `
          <div class="product-desc" style="font-weight: 500; color: #444; margin-top: 4px;">
            <strong>Ingredientes/Opções:</strong> ${product.ingredients}
          </div>
        ` : '';

        const sidesHtml = product.isMeal && product.allowedSides && product.allowedSides.length > 0 ? (() => {
          const allowedNames = product.allowedSides
            .map(id => {
              const s = sides.find(side => side.id === id);
              return s ? s.name : null;
            })
            .filter(Boolean)
            .join(', ');
          return allowedNames ? `
            <div class="product-desc" style="font-weight: 500; color: #444; margin-top: 4px;">
              <strong>Acompanhamentos Permitidos:</strong> ${allowedNames}
            </div>
          ` : '';
        })() : '';

        return `
          <div class="product-block">
            <div class="product-title">${idx + 1}. ${product.title.toUpperCase()} [${activeStatusText}]</div>
            ${product.description ? `<div class="product-desc">${product.description}</div>` : ''}
            ${fillingsHtml}
            ${ingredientsHtml}
            ${sidesHtml}
            ${catalogLabel ? `<div class="product-catalog">Catálogo: ${catalogLabel}</div>` : ''}
            <div class="product-price">${priceStr}</div>
          </div>
        `;
      }).join('');

      return `
        <div class="category-block">
          <div class="category-title">${group.categoryTitle.toUpperCase()}</div>
          ${productsHtml}
        </div>
      `;
    }).join('');

    printWithIframe(`
      <html>
        <head>
          <title>Cardápio Completo</title>
          <style>
            @page { size: auto; margin: 20mm; }
            body { 
              font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              width: 100%; 
              max-width: 170mm; 
              margin: 0 auto; 
              padding: 0; 
              font-size: 14px; 
              color: #111; 
              line-height: 1.5; 
            }
            .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 15px; margin-bottom: 25px; }
            .header h1 { font-size: 24px; margin: 0 0 5px 0; text-transform: uppercase; font-weight: 800; letter-spacing: -0.5px; }
            .header p { font-size: 13px; margin: 3px 0; color: #666; font-weight: 500; }
            .category-block { margin-top: 25px; }
            .category-title { font-weight: 800; font-size: 16px; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 15px; text-transform: uppercase; color: #000; }
            .product-block { margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            .product-title { font-weight: 700; font-size: 14px; color: #000; }
            .product-desc { font-size: 13px; color: #555; margin: 4px 0; }
            .product-catalog { font-size: 12px; font-style: italic; color: #777; }
            .product-price { font-weight: 700; font-size: 14px; white-space: pre-wrap; margin-top: 4px; color: #111; }
            @media print {
              body { width: 100%; max-width: 100%; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${settings?.brandName || 'Day’s Treats'}</h1>
            <p>Relatório de Produtos do Cardápio</p>
            <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
            <p>Total de Produtos: ${products.length}</p>
          </div>
          ${contentHtml || '<div style="text-align: center; padding: 15px; color: #666;">Nenhum produto cadastrado.</div>'}
        </body>
      </html>
    `);
  };

  const printProductionSummary = () => {
    const listTitle = orderTypeTab === 'b2b'
      ? 'RESUMO PRODUÇÃO - B2B'
      : 'RESUMO PRODUÇÃO - VAREJO';

    const itemsHtml = Object.entries(batchSummary.items).map(([title, qty]) => `
      <div class="summary-row">
        <span class="title">${title}</span>
        <span class="qty">${qty}x</span>
      </div>
    `).join('');

    const sidesHtml = Object.entries(batchSummary.sides).map(([name, qty]) => `
      <div class="summary-row">
        <span class="title">${name}</span>
        <span class="qty">${qty}x</span>
      </div>
    `).join('');

    const dateRangeText = (startDate || endDate) 
      ? `Período: ${startDate || 'Início'} até ${endDate || 'Fim'}`
      : 'Todos os Pedidos';

    printWithIframe(`
      <html>
        <head>
          <title>${listTitle}</title>
          <style>
            @page { size: auto; margin: 20mm; }
            body { 
              font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              width: 100%; 
              max-width: 170mm; 
              margin: 0 auto; 
              padding: 0; 
              font-size: 14px; 
              color: #111; 
              line-height: 1.5; 
            }
            .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 15px; margin-bottom: 25px; }
            .header h1 { font-size: 24px; margin: 0 0 5px 0; text-transform: uppercase; font-weight: 800; letter-spacing: -0.5px; }
            .header p { font-size: 13px; margin: 3px 0; color: #666; font-weight: 500; }
            .section { margin-bottom: 30px; }
            .section-title { font-weight: 800; font-size: 16px; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 15px; text-transform: uppercase; color: #000; }
            .summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px; }
            .summary-row .title { max-width: 80%; font-weight: 500; }
            .summary-row .qty { font-weight: 700; font-size: 15px; color: #000; }
            @media print {
              body { width: 100%; max-width: 100%; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${listTitle}</h1>
            <p>${dateRangeText}</p>
            <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
          </div>
          
          <div class="section">
            <div class="section-title">📦 TOTAL DE ITENS</div>
            <div>
              ${itemsHtml || '<div style="text-align: center; padding: 5px; color: #666;">Nenhum item no período.</div>'}
            </div>
          </div>

          <div class="section">
            <div class="section-title">➕ ACOMPANHAMENTOS</div>
            <div>
              ${sidesHtml || '<div style="text-align: center; padding: 5px; color: #666;">Nenhum acompanhamento.</div>'}
            </div>
          </div>
        </body>
      </html>
    `);
  };

  const handleEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingOrder) return;
    try {
      await updateDoc(doc(db, 'pedidos', isEditingOrder.id), editOrderForm);
      if (selectedCalendarOrder && selectedCalendarOrder.id === isEditingOrder.id) {
        setSelectedCalendarOrder(prev => prev ? ({ ...prev, ...editOrderForm } as Order) : null);
      }
      setIsEditingOrder(null);
      toast.success('Pedido atualizado!');
    } catch (err) {
      toast.error('Erro ao atualizar pedido.');
    }
  };

  const handleUpdateOrderStatus = async (
    orderId: string, 
    updates: Partial<Pick<Order, 'paymentStatus' | 'productionStatus' | 'deliveryStatus'>>
  ) => {
    try {
      await updateDoc(doc(db, 'pedidos', orderId), updates);
      if (selectedCalendarOrder && selectedCalendarOrder.id === orderId) {
        setSelectedCalendarOrder(prev => prev ? ({ ...prev, ...updates } as Order) : null);
      }
      toast.success('Status atualizado em tempo real!');
    } catch (err) {
      console.error('Erro ao atualizar status do pedido:', err);
      toast.error('Erro ao salvar alteração do status.');
    }
  };

  const handleSavePopupDeliveryDateTime = async (orderId: string) => {
    if (!popupEditDate) {
      toast.error('Informe a data agendada.');
      return;
    }
    setIsSavingPopupDateTime(true);
    try {
      const timeVal = popupEditTime.trim() || '12:00 PM';
      const formattedPickup = `${popupEditDate} at ${timeVal}`;
      const updates = {
        scheduledDate: popupEditDate,
        scheduledTime: timeVal,
        fulfillmentType: popupEditFulfillment,
        pickupDate: formattedPickup
      };
      await updateDoc(doc(db, 'pedidos', orderId), updates);
      if (selectedCalendarOrder && selectedCalendarOrder.id === orderId) {
        setSelectedCalendarOrder(prev => prev ? ({ ...prev, ...updates } as Order) : null);
      }
      setIsEditingPopupDateTime(false);
      toast.success('Data e horário de entrega atualizados com sucesso!');
    } catch (err: any) {
      console.error('Erro ao atualizar data:', err);
      toast.error('Erro ao salvar nova data: ' + (err?.message || 'Tente novamente'));
    } finally {
      setIsSavingPopupDateTime(false);
    }
  };

  const handleSaveManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const clientName = manualOrderForm.isB2B 
      ? (manualOrderForm.b2bCompanyName || manualOrderForm.customerName)
      : manualOrderForm.customerName;

    if (!clientName.trim()) {
      toast.error('Por favor, preencha o nome do cliente ou da empresa.');
      return;
    }

    if (manualOrderForm.items.length === 0 && (!manualOrderForm.totalOverride || parseFloat(manualOrderForm.totalOverride) <= 0)) {
      toast.error('Por favor, adicione ao menos um item ao pedido ou informe o valor total.');
      return;
    }

    try {
      const subtotal = manualOrderForm.items.reduce((acc, it) => acc + (it.price * it.quantity), 0);
      const taxAmount = manualOrderForm.applyTax ? (subtotal * (manualOrderForm.taxRate / 100)) : 0;
      const computedTotal = subtotal + taxAmount;
      const finalTotal = manualOrderForm.totalOverride && parseFloat(manualOrderForm.totalOverride) >= 0
        ? parseFloat(manualOrderForm.totalOverride)
        : computedTotal;

      const formattedPickupDate = `${manualOrderForm.scheduledDate}${manualOrderForm.scheduledTime ? ` at ${manualOrderForm.scheduledTime}` : ''}`;

      const computedAddress = manualOrderForm.fulfillmentType === 'delivery'
        ? (manualOrderForm.address || `${manualOrderForm.street || ''} ${manualOrderForm.number ? `, ${manualOrderForm.number}` : ''} ${manualOrderForm.city ? `- ${manualOrderForm.city}` : ''} ${manualOrderForm.zipCode ? `(${manualOrderForm.zipCode})` : ''}`.trim() || 'DELIVERY')
        : 'PICKUP';

      const orderData: any = {
        customerName: (manualOrderForm.customerName || clientName).trim(),
        phone: manualOrderForm.phone.trim(),
        email: manualOrderForm.email.trim(),
        birthday: manualOrderForm.birthday.trim(),
        fulfillmentType: manualOrderForm.fulfillmentType,
        scheduledDate: manualOrderForm.scheduledDate || '',
        scheduledTime: manualOrderForm.scheduledTime || '',
        paymentStatus: manualOrderForm.paymentStatus || 'nao_pago',
        productionStatus: manualOrderForm.productionStatus || 'pendente',
        deliveryStatus: manualOrderForm.deliveryStatus || 'a_entregar',
        pickupDate: formattedPickupDate,
        address: computedAddress,
        street: manualOrderForm.street.trim(),
        number: manualOrderForm.number.trim(),
        city: manualOrderForm.city.trim(),
        zipCode: manualOrderForm.zipCode.trim(),
        observation: manualOrderForm.observation.trim(),
        items: manualOrderForm.items,
        subtotal: subtotal,
        taxRate: manualOrderForm.applyTax ? manualOrderForm.taxRate : 0,
        taxAmount: taxAmount,
        total: finalTotal,
        createdAt: serverTimestamp(),
        orderLanguage: settings?.language || 'pt',
        isB2B: !!manualOrderForm.isB2B,
        isPJ: !!manualOrderForm.isB2B,
        b2bCompanyName: manualOrderForm.b2bCompanyName.trim(),
        b2bManagerName: manualOrderForm.b2bManagerName.trim(),
        source: 'manual_admin'
      };

      await addDoc(collection(db, 'pedidos'), orderData);
      toast.success('Pedido manual criado com sucesso!');
      setIsCreatingManualOrder(false);
    } catch (err: any) {
      console.error('Erro ao salvar pedido manual:', err);
      toast.error('Erro ao salvar pedido: ' + (err?.message || 'Tente novamente'));
    }
  };

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId) 
        : [...prev, orderId]
    );
  };

  const copyLink = () => {
    const url = `${window.location.origin}/?slug=${settings?.slug || 'easy-menu'}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const printOrder = (order: Order) => {
    let issueDateStr = 'N/A';
    if (order.createdAt) {
      const dateObj = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      issueDateStr = `${months[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
    }

    let serviceDateStr = 'N/A';
    if (order.scheduledDate) {
      const parts = order.scheduledDate.split('-');
      if (parts.length === 3) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const year = parts[0];
        const month = months[parseInt(parts[1]) - 1] || parts[1];
        const day = parts[2];
        serviceDateStr = `${month} ${parseInt(day)}, ${year}`;
      }
    } else if (order.pickupDate) {
      serviceDateStr = order.pickupDate;
    }

    const fulfillmentHeader = order.fulfillmentType === 'delivery'
      ? 'Delivery'
      : `Retirar ${order.scheduledTime || ''}`;

    let itemsHtml = order.items.map(item => {
      let optionsHtml = '';
      if (item.cakeOptions && (item.cakeOptions.size || item.cakeOptions.dough || item.cakeOptions.fillings || item.cakeOptions.styleNumber || item.cakeOptions.customReferenceDescription)) {
        optionsHtml = `
          <div class="item-subs">
            ${item.cakeOptions.size ? `<div>SIZE: ${item.cakeOptions.size}</div>` : ''}
            ${item.cakeOptions.dough ? `<div>DOUGH: ${item.cakeOptions.dough}</div>` : ''}
            ${item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0 ? `<div>FILLINGS: ${item.cakeOptions.fillings.join(', ')}</div>` : ''}
            ${item.cakeOptions.topping ? `<div>TOPPING: ${item.cakeOptions.topping}</div>` : ''}
            ${item.cakeOptions.topper ? `<div>TOPPER: ${item.cakeOptions.topper}</div>` : ''}
            ${item.cakeOptions.styleNumber ? `<div>REF. FOTO: #${item.cakeOptions.styleNumber}</div>` : ''}
            ${item.cakeOptions.customReferenceDescription ? `<div>REF. PERSONALIZADA: ${item.cakeOptions.customReferenceDescription}</div>` : ''}
          </div>
        `;
      } else if (item.sandwichOptions && item.sandwichOptions.fillings && item.sandwichOptions.fillings.length > 0) {
        optionsHtml = `
          <div class="item-subs">
            <div>FILLINGS: ${item.sandwichOptions.fillings.join(', ')}</div>
          </div>
        `;
      } else if (item.mealOptions) {
        optionsHtml = `
          <div class="item-subs">
            ${item.mealOptions.removals.length > 0 ? `<div>REMOVED INGREDIENTS: ${item.mealOptions.removals.join(', ')}</div>` : ''}
            ${item.mealOptions.sides.length > 0 ? `<div>SIDES: ${item.mealOptions.sides.map(s => s.name).join(', ')}</div>` : ''}
          </div>
        `;
      }

      const itemPrice = item.price || 0;
      const totalItemPrice = itemPrice * item.quantity;

      return `
        <tr>
          <td>
            <div class="item-name">${item.title.toUpperCase()}</div>
            ${optionsHtml}
          </td>
          <td class="qty-cell">${item.quantity}</td>
          <td class="price-cell">${currencySymbol}${itemPrice.toFixed(2)}</td>
          <td class="amount-cell">${currencySymbol}${totalItemPrice.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const calculatedSubtotal = order.subtotal || (order.total / 1.0825);
    const calculatedTax = order.taxAmount || (order.total - calculatedSubtotal);

    printWithIframe(`
      <html>
        <head>
          <title>Invoice - ${order.customerName}</title>
          <style>
            @page { 
              size: portrait; 
              margin: 6mm 10mm; 
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #212529;
              margin: 0;
              padding: 0;
              font-size: 11px;
              line-height: 1.35;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .container {
              width: 100%;
              max-width: 190mm;
              margin: 0 auto;
              page-break-inside: avoid;
            }
            .top-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              padding-bottom: 8px;
            }
            .logo-area {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .logo-circle {
              width: 44px;
              height: 44px;
              border-radius: 50%;
              background-color: #fce4ec;
              border: 1px solid #f8bbd0;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            .logo-img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .logo-text-placeholder {
              font-weight: 800;
              color: #ec407a;
              font-size: 18px;
              font-family: serif;
            }
            .company-info h2 {
              margin: 0 0 2px 0;
              font-size: 14px;
              font-weight: 800;
              color: #212529;
            }
            .company-info p {
              margin: 0;
              font-size: 10px;
              color: #495057;
              line-height: 1.3;
            }
            .invoice-meta {
              text-align: right;
            }
            .invoice-meta h1 {
              margin: 0 0 3px 0;
              font-size: 13px;
              font-weight: 800;
              color: #212529;
            }
            .invoice-meta p {
              margin: 0 0 2px 0;
              font-size: 10px;
              color: #495057;
            }
            .invoice-meta .meta-value {
              font-weight: 700;
              color: #212529;
            }
            .thick-divider {
              border-top: 3px solid #adb5bd;
              margin: 6px 0 8px 0;
            }
            .fulfillment-title {
              font-size: 24px;
              font-weight: 900;
              margin: 6px 0 8px 0;
              color: #000000;
              letter-spacing: -0.5px;
            }
            .thin-divider {
              border-top: 1px solid #dee2e6;
              margin-bottom: 10px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
              margin-bottom: 12px;
            }
            .info-col h3 {
              font-size: 10px;
              font-weight: 800;
              color: #495057;
              text-transform: uppercase;
              margin: 0 0 4px 0;
              border-bottom: 1px solid #dee2e6;
              padding-bottom: 2px;
              letter-spacing: 0.5px;
            }
            .info-col p {
              margin: 0 0 2px 0;
              font-size: 10.5px;
              color: #495057;
              line-height: 1.3;
            }
            .info-col .col-highlight {
              font-weight: 700;
              color: #212529;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 10px;
            }
            .items-table th {
              font-size: 10px;
              text-transform: uppercase;
              color: #495057;
              font-weight: 800;
              border-bottom: 1px solid #adb5bd;
              padding: 4px 0;
              text-align: left;
            }
            .items-table th.right-align {
              text-align: right;
            }
            .items-table td {
              padding: 4px 0;
              border-bottom: 1px solid #dee2e6;
              vertical-align: top;
            }
            .item-name {
              font-size: 11px;
              font-weight: 800;
              color: #212529;
              text-transform: uppercase;
            }
            .item-subs {
              font-size: 9px;
              color: #6c757d;
              margin-top: 2px;
              line-height: 1.25;
              text-transform: uppercase;
            }
            .items-table td.qty-cell {
              text-align: right;
              font-weight: 600;
              color: #212529;
              font-size: 11px;
              width: 50px;
            }
            .items-table td.price-cell {
              text-align: right;
              color: #495057;
              font-size: 11px;
              width: 80px;
            }
            .items-table td.amount-cell {
              text-align: right;
              font-weight: 700;
              color: #212529;
              font-size: 11px;
              width: 80px;
            }
            .summary-container {
              display: flex;
              flex-direction: column;
              align-items: flex-end;
              margin-top: 6px;
              page-break-inside: avoid;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              width: 220px;
              padding: 2px 0;
              font-size: 10.5px;
              color: #495057;
            }
            .summary-row.total-row {
              border-top: 2px solid #212529;
              margin-top: 4px;
              padding-top: 4px;
              font-size: 15px;
              font-weight: 900;
              color: #000;
            }
            .obs-box {
              background-color: #f8f9fa;
              border: 1px solid #dee2e6;
              border-radius: 6px;
              padding: 6px 10px;
              margin-top: 8px;
              page-break-inside: avoid;
            }
            .obs-title {
              font-size: 9px;
              font-weight: 800;
              text-transform: uppercase;
              color: #6c757d;
              margin-bottom: 2px;
            }
            .obs-content {
              font-size: 10px;
              color: #212529;
              font-style: italic;
              line-height: 1.3;
            }
            @media print {
              html, body {
                height: auto;
                width: 100%;
                margin: 0 !important;
                padding: 0 !important;
              }
              .container { 
                max-width: 100% !important; 
                page-break-inside: avoid !important;
              }
              tr, .summary-container, .obs-box, .top-header, .info-grid {
                page-break-inside: avoid !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="top-header">
              <div class="logo-area">
                <div class="logo-circle">
                  ${settings?.logo 
                    ? `<img src="${settings.logo}" class="logo-img" />` 
                    : `<span class="logo-text-placeholder">DT</span>`
                  }
                </div>
                <div class="company-info">
                  <h2>${settings?.brandName || "Day's Treats"}</h2>
                  <p>300 N Lake St</p>
                  <p>Mundelein, IL 60060-2208 United States</p>
                  <p>daystreatsbakery@gmail.com | (224) 424-9553</p>
                </div>
              </div>
              <div class="invoice-meta">
                <h1>Invoice #00${order.id.toUpperCase().slice(-6)}</h1>
                <p><span class="meta-label">Issue date:</span> <span class="meta-value">${issueDateStr}</span></p>
              </div>
            </div>

            <div class="thick-divider"></div>

            <div class="fulfillment-title">
              ${fulfillmentHeader}
            </div>

            <div class="thin-divider"></div>

            <div class="info-grid">
              <div class="info-col">
                <h3>Customer</h3>
                <p class="col-highlight">${order.customerName.toUpperCase()}</p>
                <p>${order.email || ''}</p>
                <p>${order.phone}</p>
                ${order.address && order.address !== 'PICKUP' ? `<p>${order.address.toUpperCase()}</p>` : ''}
                ${order.birthday ? `<p>Birthday: ${order.birthday}</p>` : ''}
              </div>
              <div class="info-col">
                <h3>Invoice Details</h3>
                <p>PDF created ${issueDateStr}</p>
                <p>${currencySymbol}${order.total.toFixed(2)}</p>
                <p>Service date: <span class="col-highlight">${serviceDateStr}</span></p>
              </div>
              <div class="info-col">
                <h3>Payment</h3>
                <p>Due ${issueDateStr}</p>
                <p class="col-highlight">${currencySymbol}${order.total.toFixed(2)}</p>
              </div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th>Items</th>
                  <th class="right-align" style="width: 60px;">Quantity</th>
                  <th class="right-align" style="width: 100px;">Price</th>
                  <th class="right-align" style="width: 100px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="summary-container">
              <div class="summary-row">
                <span>Subtotal</span>
                <span>${currencySymbol}${calculatedSubtotal.toFixed(2)}</span>
              </div>
              <div class="summary-row">
                <span>Sales Taxes</span>
                <span>${currencySymbol}${calculatedTax.toFixed(2)}</span>
              </div>
              <div class="summary-row total-row">
                <span>Total Due</span>
                <span>${currencySymbol}${order.total.toFixed(2)}</span>
              </div>
            </div>

            ${order.observation ? `
              <div class="obs-box">
                <div class="obs-title">Observation</div>
                <div class="obs-content">${order.observation.toUpperCase()}</div>
              </div>
            ` : ''}
          </div>
        </body>
      </html>
    `);
  };

  const isBirthdayThisWeek = (birthdayStr: string, orderLanguage?: string) => {
    if (!birthdayStr) return false;
    
    // Expected format is strictly MM/DD, but we will add a smart fallback for legacy DD/MM
    const parts = birthdayStr.split('/');
    if (parts.length < 2) return false;
    
    let month = parseInt(parts[0]) - 1; // 0-indexed month
    let day = parseInt(parts[1]);
    
    // Smart Fallback: if the first part is greater than 12, it is definitely DD/MM
    if (parseInt(parts[0]) > 12) {
      day = parseInt(parts[0]);
      month = parseInt(parts[1]) - 1;
    }
    
    if (isNaN(day) || isNaN(month) || month < 0 || month > 11) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();
    
    // Check multiple years to handle boundary conditions safely
    const checkDates = [
      new Date(currentYear - 1, month, day),
      new Date(currentYear, month, day),
      new Date(currentYear + 1, month, day)
    ];
    
    return checkDates.some(bday => {
      const diffTime = bday.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      // Capture birthdays from 3 days ago up to 14 days in the future (generous "Aniversários da Semana" window)
      return diffDays >= -3 && diffDays <= 14;
    });
  };

  const orderBelongsToCatalog = (order: Order, catalogId: 'catalog1' | 'catalog2' | 'catalog3') => {
    if (!order.items || order.items.length === 0) return false;
    return order.items.some(item => {
      const prod = products.find(p => p.title === item.title);
      if (!prod) return false;
      const catObj = categories.find(c => c.id === prod.categoryId);
      if (!catObj) return false;
      const catVal = catObj.catalog || 'catalog1';
      return catVal === catalogId || catVal === 'both' || catVal === 'all';
    });
  };

  const filteredProducts = useMemo(() => {
    const query = productSearch.toLowerCase().trim();
    if (!query) return products;
    return products.filter(product => 
      product.title.toLowerCase().includes(query) || 
      (product.description || '').toLowerCase().includes(query)
    );
  }, [products, productSearch]);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(orderSearch.toLowerCase());
    
    const parseDateString = (str: string, lang?: string) => {
      if (!str || !str.includes('/')) return null;
      const parts = str.split('/');
      if (parts.length !== 3) return null;
      
      let month = parseInt(parts[0]);
      let day = parseInt(parts[1]);
      let year = parseInt(parts[2]);

      // Always treat as MM/DD/YYYY by default (USA pattern), but if the first part (month) is > 12, it is definitely DD/MM/YYYY
      if (month > 12) {
        day = parseInt(parts[0]);
        month = parseInt(parts[1]);
      }
      
      if (!day || !month || !year || month > 12) return null;
      const d = new Date(year, month - 1, day);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    let matchesDate = true;
    if (startDate || endDate) {
      // Try to use pickupDate first if available, otherwise use createdAt
      let orderDate: Date | null = null;
      if (order.pickupDate) {
        orderDate = parseDateString(order.pickupDate, order.orderLanguage || settings.language || 'pt');
      }
      
      if (!orderDate && order.createdAt?.toDate) {
        orderDate = order.createdAt.toDate();
        orderDate.setHours(0, 0, 0, 0);
      }

      if (orderDate) {
        if (startDate && startDate.length === 10) {
          const start = parseDateString(startDate, settings.language || 'pt');
          if (start && orderDate < start) matchesDate = false;
        }
        if (endDate && endDate.length === 10) {
          const end = parseDateString(endDate, settings.language || 'pt');
          if (end && orderDate > end) matchesDate = false;
        }
      } else {
        matchesDate = false;
      }
    }
    
    const isB2bOrder = order.isB2B === true || order.isPJ === true;
    const matchesTab = orderTypeTab === 'b2b' ? isB2bOrder : !isB2bOrder;
    
    let matchesCatalog = true;
    if (selectedHistoryCatalog !== 'all') {
      matchesCatalog = orderBelongsToCatalog(order, selectedHistoryCatalog);
    }
    
    return matchesSearch && matchesDate && matchesTab && matchesCatalog;
  }).sort((a, b) => {
    const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return timeB - timeA;
  });

  const batchSummary = useMemo(() => {
    const summary: { [key: string]: number } = {};
    const sidesSummary: { [key: string]: number } = {};

    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const key = item.title;
        summary[key] = (summary[key] || 0) + item.quantity;

        if (item.mealOptions?.sides) {
          item.mealOptions.sides.forEach(side => {
            sidesSummary[side.name] = (sidesSummary[side.name] || 0) + item.quantity;
          });
        }
      });
    });

    return { items: summary, sides: sidesSummary };
  }, [filteredOrders]);

  const currencySymbol = settings?.currency === 'USD' ? '$' : 'R$';

  if (!isLoggedIn) {
    return (
      <div className="flex-grow flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass p-8 rounded-3xl w-full max-w-md shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="h-24 w-24 flex items-center justify-center mb-4 rounded-full overflow-hidden border-2 border-white shadow-md bg-white">
              <img src={settings?.logo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <h1 className="text-2xl font-serif font-bold opacity-90">Painel adm - Easy menu</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              placeholder="Senha de acesso"
              className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 outline-none"
              style={{ '--tw-ring-color': settings?.primaryColor || '#865d39' } as any}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button 
              type="submit"
              className="w-full py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-all"
              style={{ 
                backgroundColor: settings?.primaryColor || '#865d39',
                color: getContrastText(settings?.primaryColor || '#865d39')
              }}
            >
              Entrar
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col md:flex-row md:h-screen md:overflow-hidden text-gray-900">
      <div className="w-full md:w-72 shrink-0 bg-white/95 backdrop-blur-md border-r border-gray-200/90 p-4 md:p-6 flex flex-col gap-4 md:gap-6 md:overflow-y-auto shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 flex items-center justify-center rounded-full overflow-hidden border border-gray-200 bg-white shadow-sm shrink-0">
            <img src={settings?.logo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <span className="font-serif font-bold text-lg opacity-90 truncate">{settings?.brandName || 'Easy Plate Menu'}</span>
        </div>
        
        <nav className="flex flex-col gap-2 w-full">
          <button 
            onClick={() => setActiveTab('orders')}
            className={cn(
              "w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm cursor-pointer",
              activeTab === 'orders' ? "shadow-md font-extrabold" : "hover:bg-black/5 text-gray-800"
            )}
            style={activeTab === 'orders' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <History size={18} className="shrink-0" /> <span className="truncate">Histórico de Pedidos</span>
          </button>
          <button 
            onClick={() => setActiveTab('customers')}
            className={cn(
              "w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm cursor-pointer",
              activeTab === 'customers' ? "shadow-md font-extrabold" : "hover:bg-black/5 text-gray-800"
            )}
            style={activeTab === 'customers' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <Users size={18} className="shrink-0" /> <span className="truncate">Clientes</span>
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={cn(
              "w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm cursor-pointer",
              activeTab === 'categories' ? "shadow-md font-extrabold" : "hover:bg-black/5 text-gray-800"
            )}
            style={activeTab === 'categories' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <Layers size={18} className="shrink-0" /> <span className="truncate">Categorias</span>
          </button>
          <button 
            onClick={() => setActiveTab('menu')}
            className={cn(
              "w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm cursor-pointer",
              activeTab === 'menu' ? "shadow-md font-extrabold" : "hover:bg-black/5 text-gray-800"
            )}
            style={activeTab === 'menu' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <Package size={18} className="shrink-0" /> <span className="truncate">Gerenciar Cardápio</span>
          </button>
          <button 
            onClick={() => setActiveTab('reorderProducts')}
            className={cn(
              "w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm cursor-pointer",
              activeTab === 'reorderProducts' ? "shadow-md font-extrabold" : "hover:bg-black/5 text-gray-800"
            )}
            style={activeTab === 'reorderProducts' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <ArrowUpDown size={18} className="shrink-0" /> <span className="truncate">Organizar Itens</span>
          </button>
          <button 
            onClick={() => setActiveTab('sides')}
            className={cn(
              "w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm cursor-pointer",
              activeTab === 'sides' ? "shadow-md font-extrabold" : "hover:bg-black/5 text-gray-800"
            )}
            style={activeTab === 'sides' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <Plus size={18} className="shrink-0" /> <span className="truncate">Acompanhamentos</span>
          </button>
          <button 
            onClick={() => setActiveTab('cakeOptions')}
            className={cn(
              "w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm cursor-pointer",
              activeTab === 'cakeOptions' ? "shadow-md font-extrabold" : "hover:bg-black/5 text-gray-800"
            )}
            style={activeTab === 'cakeOptions' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <Cake size={18} className="shrink-0" /> <span className="truncate">Opções de Bolos</span>
          </button>
          <button 
            onClick={() => setActiveTab('galleries')}
            className={cn(
              "w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm cursor-pointer",
              activeTab === 'galleries' ? "shadow-md font-extrabold" : "hover:bg-black/5 text-gray-800"
            )}
            style={activeTab === 'galleries' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <ImageIcon size={18} className="shrink-0" /> <span className="truncate">Galerias de Imagem</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm cursor-pointer",
              activeTab === 'settings' ? "shadow-md font-extrabold" : "hover:bg-black/5 text-gray-800"
            )}
            style={activeTab === 'settings' ? { backgroundColor: settings?.primaryColor || '#865d39', color: getContrastText(settings?.primaryColor || '#865d39') } : {}}
          >
            <SettingsIcon size={18} className="shrink-0" /> <span className="truncate">Configurações</span>
          </button>
        </nav>

        <button 
          onClick={() => {
            setIsLoggedIn(false);
            setIsAdmin(false);
            window.history.pushState({}, '', '/');
          }}
          className="mt-auto w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-red-50 text-red-600 transition-all font-bold text-sm cursor-pointer"
        >
          <LogOut size={18} className="shrink-0" /> <span>Sair</span>
        </button>
      </div>

      <main id="admin-main-content" className="flex-grow p-4 md:p-10 overflow-y-auto min-w-0 w-full">
        {activeTab === 'galleries' && (
          <div className="max-w-5xl space-y-8 pb-10">
            <div className="flex items-center justify-between border-b border-gray-200/50 pb-4">
              <div>
                <h1 className="text-3xl font-serif font-black text-gray-950">Galerias de Imagem</h1>
                <p className="text-sm text-black font-semibold opacity-100" style={{ color: '#000000' }}>Crie e gerencie até 6 galerias com 6 fotos cada para exibir como referências de estilo para bolos personalizados.</p>
              </div>
              <div>
                <button
                  type="button"
                  disabled={galleries.length >= 6}
                  onClick={async () => {
                    if (galleries.length >= 6) {
                      toast.error("O limite é de no máximo 6 galerias!");
                      return;
                    }
                    try {
                      await addDoc(collection(db, "galerias"), {
                        name: `Galeria ${galleries.length + 1}`,
                        images: ["", "", "", "", "", ""]
                      });
                      toast.success("Galeria criada com sucesso!");
                    } catch (e) {
                      toast.error("Erro ao criar galeria.");
                    }
                  }}
                className={cn(
                    "flex items-center gap-1.5 py-4 px-6 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow border-0",
                    galleries.length >= 6 ? "bg-gray-400 text-white cursor-not-allowed" : "hover:scale-[1.02] cursor-pointer"
                  )}
                  style={galleries.length >= 6 ? {} : { 
                    backgroundColor: settings.primaryColor || '#865d39',
                    color: getContrastText(settings.primaryColor || '#865d39')
                  }}
                >
                  <Plus size={16} /> Criar Nova Galeria ({galleries.length}/6)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {galleries.map((gallery) => (
                <div key={gallery.id} className="glass p-6 rounded-3xl space-y-4 relative flex flex-col justify-between">
                  <div>
                    {/* Gallery Title Input and Delete Button */}
                    <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-3 mb-2">
                      <input
                        type="text"
                        value={gallery.name}
                        onChange={async (e) => {
                          const val = e.target.value;
                          await updateDoc(doc(db, "galerias", gallery.id), {
                            name: val
                          });
                        }}
                        className="font-serif font-black text-lg bg-transparent border-b border-transparent hover:border-black/20 focus:border-black/50 focus:outline-none transition-all w-3/4 pb-0.5 text-black"
                        placeholder="Nome da Galeria"
                      />
                      {galleryIdToDelete === gallery.id ? (
                        <div className="flex items-center gap-1.5 animate-fade-in">
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await deleteDoc(doc(db, "galerias", gallery.id));
                                toast.success("Galeria removida com sucesso!");
                                setGalleryIdToDelete(null);
                              } catch (e) {
                                toast.error("Erro ao remover galeria.");
                              }
                            }}
                            className="px-2 py-1 text-xs text-white rounded-lg font-bold transition-all border-0 cursor-pointer shadow-sm"
                            style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                          >
                            Excluir
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setGalleryIdToDelete(null);
                            }}
                            className="px-2 py-1 text-xs text-black bg-gray-200 hover:bg-gray-300 rounded-lg font-bold transition-all border-0 cursor-pointer"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setGalleryIdToDelete(gallery.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors font-medium border-0 cursor-pointer"
                          title="Excluir Galeria"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {/* Image uploads grid - 6 separate slots */}
                    <div className="bg-white/60 border border-white/30 rounded-2xl p-3 mt-2 shadow-sm">
                      <p className="text-[11px] font-bold text-gray-950 leading-relaxed text-center">
                        Gerencie as 6 imagens da galeria de forma independente abaixo. Clique em um espaço para fazer upload ou apague para remover.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3.5 mt-3">
                      {[0, 1, 2, 3, 4, 5].map((index) => {
                        const currentImg = gallery.images?.[index] || "";
                        return (
                          <div key={index} className="flex flex-col items-center gap-1.5">
                            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-white/40 border border-black/10 flex items-center justify-center group shadow-sm">
                              {currentImg ? (
                                <>
                                  <img
                                    src={currentImg}
                                    alt={`Slot ${index + 1}`}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-1.5 p-1">
                                    {/* Edit Upload */}
                                    <label className="p-1.5 bg-white text-gray-800 rounded-full cursor-pointer hover:scale-105 shadow hover:text-black">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          handleFileChange(e, async (b64) => {
                                            const updatedImages = [...(gallery.images || ["", "", "", "", "", ""])];
                                            updatedImages[index] = b64;
                                            await updateDoc(doc(db, "galerias", gallery.id), {
                                              images: updatedImages
                                            });
                                            toast.success(`Foto ${index + 1} alterada com sucesso!`);
                                          }, true);
                                        }}
                                      />
                                      <Edit2 size={12} />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const updatedImages = [...(gallery.images || ["", "", "", "", "", ""])];
                                        updatedImages[index] = "";
                                        await updateDoc(doc(db, "galerias", gallery.id), {
                                          images: updatedImages
                                        });
                                        toast.success(`Foto ${index + 1} removida!`);
                                      }}
                                      className="p-1.5 bg-red-500 text-white rounded-full hover:scale-105 shadow border-0 cursor-pointer"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-white/50 transition-colors p-2 text-center text-gray-500 hover:text-black select-none">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      handleFileChange(e, async (b64) => {
                                        const updatedImages = [...(gallery.images || ["", "", "", "", "", ""])];
                                        updatedImages[index] = b64;
                                        await updateDoc(doc(db, "galerias", gallery.id), {
                                          images: updatedImages
                                        });
                                        toast.success(`Foto ${index + 1} adicionada com sucesso!`);
                                      }, true);
                                    }}
                                  />
                                  <Plus size={16} className="text-gray-400" />
                                  <span className="text-[9px] font-black uppercase tracking-wider mt-1 opacity-60">Enviar</span>
                                </label>
                              )}
                            </div>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-black/60">Foto {index + 1}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {galleries.length === 0 && (
                <div className="md:col-span-2 glass p-10 rounded-3xl text-center space-y-3">
                  <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center mx-auto text-gray-400">
                    <ImageIcon size={24} />
                  </div>
                  <div>
                    <h3 className="font-serif font-black text-lg text-black">Nenhuma galeria criada</h3>
                    <p className="text-xs font-semibold text-gray-500 max-w-sm mx-auto leading-normal">Comece criando uma nova galeria de fotos separadas acima e vincule-a nos seus bolos personalizados!</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'cakeOptions' && (
          <div className="max-w-4xl space-y-8 pb-10">
            <div className="flex items-center justify-between border-b border-gray-200/50 pb-4">
              <div>
                <h1 className="text-3xl font-serif font-black text-gray-950">Opções de Bolos</h1>
                <p className="text-sm text-black font-semibold opacity-100" style={{ color: '#000000' }}>Gerencie tamanhos, massas, recheios, coberturas e toppers que poderão ser customizados pelo cliente.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* TAMANHOS */}
              <div className="glass p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <h3 className="text-sm font-serif font-extrabold uppercase tracking-widest text-[#000000]" style={{ color: '#000000' }}>Tamanhos / Fatias / Peso</h3>
                  <button 
                    onClick={() => addCakeOptionItem('cakeSizes', '')}
                    className="p-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-transform cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-62 overflow-y-auto pr-1">
                  {(settings.cakeSizes || []).length === 0 ? (
                    <p className="text-xs text-black font-semibold italic py-2" style={{ color: '#000000' }}>Nenhum tamanho adicionado.</p>
                  ) : (
                    (settings.cakeSizes || []).map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="text"
                          value={item}
                          placeholder="Ex: 7 inches - 20 fatias - 1,5 kg"
                          onChange={(e) => updateCakeOptionItem('cakeSizes', idx, e.target.value)}
                          className="flex-grow bg-white/60 border border-gray-200 py-2.5 px-4 rounded-xl text-sm"
                        />
                        <button 
                          onClick={() => removeCakeOptionItem('cakeSizes', idx)}
                          className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-transform"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* MASSAS */}
              <div className="glass p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <h3 className="text-sm font-serif font-extrabold uppercase tracking-widest text-[#000000]" style={{ color: '#000000' }}>Tipos de Massa</h3>
                  <button 
                    onClick={() => addCakeOptionItem('cakeDoughs', '')}
                    className="p-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-transform cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-62 overflow-y-auto pr-1">
                  {(settings.cakeDoughs || []).length === 0 ? (
                    <p className="text-xs text-black font-semibold italic py-2" style={{ color: '#000000' }}>Nenhuma massa adicionada.</p>
                  ) : (
                    (settings.cakeDoughs || []).map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="text"
                          value={item}
                          placeholder="Ex: Chocolate, Branca, Mesclado"
                          onChange={(e) => updateCakeOptionItem('cakeDoughs', idx, e.target.value)}
                          className="flex-grow bg-white/60 border border-gray-200 py-2.5 px-4 rounded-xl text-sm"
                        />
                        <button 
                          onClick={() => removeCakeOptionItem('cakeDoughs', idx)}
                          className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-transform"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* RECHEIOS */}
              <div className="glass p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <div className="space-y-1">
                    <h3 className="text-sm font-serif font-extrabold uppercase tracking-widest text-[#000000]" style={{ color: '#000000' }}>Recheios</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-black font-extrabold" style={{ color: '#000000' }}>Máximo de opções:</span>
                      <input 
                        type="number"
                        min="1"
                        max="10"
                        value={settings.cakeFillingsMax || 2}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          setSettings(prev => ({ ...prev, cakeFillingsMax: val }));
                        }}
                        className="w-16 bg-white/60 border border-gray-200 py-1 px-2 rounded-lg text-sm text-center font-bold"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => addCakeOptionItem('cakeFillings', '')}
                    className="p-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-transform cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-62 overflow-y-auto pr-1">
                  {(settings.cakeFillings || []).length === 0 ? (
                    <p className="text-xs text-black font-semibold italic py-2" style={{ color: '#000000' }}>Nenhum recheio adicionado.</p>
                  ) : (
                    (settings.cakeFillings || []).map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="text"
                          value={item}
                          placeholder="Ex: Chocolate, Morango, Cereja, Abacaxi"
                          onChange={(e) => updateCakeOptionItem('cakeFillings', idx, e.target.value)}
                          className="flex-grow bg-white/60 border border-gray-200 py-2.5 px-4 rounded-xl text-sm"
                        />
                        <button 
                          onClick={() => removeCakeOptionItem('cakeFillings', idx)}
                          className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-transform"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* COBERTURAS */}
              <div className="glass p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <h3 className="text-sm font-serif font-extrabold uppercase tracking-widest text-[#000000]" style={{ color: '#000000' }}>Coberturas</h3>
                  <button 
                    onClick={() => addCakeOptionItem('cakeToppings', '')}
                    className="p-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-transform cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-62 overflow-y-auto pr-1">
                  {(settings.cakeToppings || []).length === 0 ? (
                    <p className="text-xs text-black font-semibold italic py-2" style={{ color: '#000000' }}>Nenhuma cobertura adicionada.</p>
                  ) : (
                    (settings.cakeToppings || []).map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="text"
                          value={item}
                          placeholder="Ex: Chocolate, Chantilly"
                          onChange={(e) => updateCakeOptionItem('cakeToppings', idx, e.target.value)}
                          className="flex-grow bg-white/60 border border-gray-200 py-2.5 px-4 rounded-xl text-sm"
                        />
                        <button 
                          onClick={() => removeCakeOptionItem('cakeToppings', idx)}
                          className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-transform"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* TOPO DO BOLO */}
              <div className="glass p-6 rounded-3xl space-y-4 md:col-span-2">
                <div className="flex justify-between items-center pb-2 border-b border-black/10">
                  <h3 className="text-sm font-serif font-extrabold uppercase tracking-widest text-[#000000]" style={{ color: '#000000' }}>Topo do Bolo (Topper)</h3>
                  <button 
                    onClick={() => addCakeOptionItem('cakeToppers', '')}
                    className="p-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-transform cursor-pointer"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2 max-h-62 overflow-y-auto pr-1">
                  {(settings.cakeToppers || []).length === 0 ? (
                    <p className="text-xs text-black font-semibold italic py-2" style={{ color: '#000000' }}>Nenhum topo de bolo adicionado.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(settings.cakeToppers || []).map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input 
                            type="text"
                            value={item}
                            placeholder="Ex: Flores, Topper"
                            onChange={(e) => updateCakeOptionItem('cakeToppers', idx, e.target.value)}
                            className="flex-grow bg-white/60 border border-gray-200 py-2.5 px-4 rounded-xl text-sm"
                          />
                          <button 
                            onClick={() => removeCakeOptionItem('cakeToppers', idx)}
                            className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:scale-95 transition-transform"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={saveSettings}
                disabled={isSaving}
                className="flex items-center gap-2 px-8 py-4 font-extrabold rounded-2xl shadow-xl transition-all active:scale-[0.98] select-none hover:shadow-2xl cursor-pointer disabled:opacity-50"
                style={{ 
                  backgroundColor: settings.primaryColor || '#865d39',
                  color: getContrastText(settings.primaryColor || '#865d39')
                }}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    <span>Salvar Opções de Bolos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-8 pb-10">
            <h2 className="text-3xl font-serif font-bold">Configure seu app</h2>
            
            <div className="glass p-6 rounded-2xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">faça o upload do seu logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-white p-1 border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                      <img src={settings?.logo} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <input 
                        type="file" 
                        id="logo-upload"
                        accept="image/*"
                        onChange={e => handleFileChange(e, (b64) => setSettings({...settings, logo: b64}))}
                        className="hidden"
                      />
                      <div className="flex gap-2">
                        <label 
                          htmlFor="logo-upload"
                          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold cursor-pointer hover:bg-gray-50 transition-colors text-black"
                        >
                          Selecionar Imagem
                        </label>
                        <button
                          type="button"
                          onClick={() => setSettings({...settings, logo: 'https://i.ibb.co/SXRBhD32/dende.png'})}
                          className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                        >
                          Remover Logo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Cor Primária</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      value={settings?.primaryColor || '#865d39'}
                      onChange={e => setSettings({...settings, primaryColor: e.target.value})}
                      className="w-12 h-12 p-1 rounded-lg cursor-pointer border border-gray-200"
                    />
                    <input 
                      type="text" 
                      className="flex-grow p-3 rounded-xl border border-gray-300 font-mono text-sm bg-white/50"
                      value={settings?.primaryColor || ''}
                      onChange={e => setSettings({...settings, primaryColor: e.target.value})}
                      placeholder="#000000"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Cor do Efeito Glass</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      value={settings?.glassColor?.startsWith('#') ? settings.glassColor : '#ffffff'}
                      onChange={e => setSettings(prev => ({...prev, glassColor: e.target.value}))}
                      className="w-12 h-12 p-1 rounded-lg cursor-pointer border border-gray-200"
                    />
                    <input 
                      type="text" 
                      className="flex-grow p-3 rounded-xl border border-gray-300 font-mono text-sm bg-white/50"
                      value={settings?.glassColor || ''}
                      onChange={e => setSettings(prev => ({...prev, glassColor: e.target.value}))}
                      placeholder="Ex: rgba(255, 255, 255, 0.4)"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Cor da Fonte (Textos)</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      value={settings?.textColor || '#000000'}
                      onChange={e => setSettings({...settings, textColor: e.target.value})}
                      className="w-12 h-12 p-1 rounded-lg cursor-pointer border border-gray-200"
                    />
                    <input 
                      type="text" 
                      className="flex-grow p-3 rounded-xl border border-gray-300 font-mono text-sm bg-white/50 text-black"
                      value={settings?.textColor || ''}
                      onChange={e => setSettings({...settings, textColor: e.target.value})}
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Slogan do App</label>
                  <textarea 
                    rows={2}
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={settings?.slogan || ''}
                    onChange={e => setSettings({...settings, slogan: e.target.value})}
                    placeholder="Ex: O sabor que você merece..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Mensagem Final WhatsApp</label>
                  <textarea 
                    rows={2}
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={settings?.whatsappClosingMessage || ''}
                    onChange={e => setSettings({...settings, whatsappClosingMessage: e.target.value})}
                    placeholder="Ex: Obrigada pelo pedido..."
                  />
                </div>
              </div>



              <div className="space-y-2">
                <label className="text-sm font-bold uppercase opacity-60">Imagem de Fundo do App</label>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-20 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                      {settings?.backgroundImage ? (
                        <img 
                          key={settings.backgroundImage}
                          src={settings.backgroundImage} 
                          alt="Background Preview" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                        />
                      ) : (
                        <div className="text-[10px] text-gray-400 font-bold uppercase">Sem fundo</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <input 
                        type="file" 
                        id="bg-upload"
                        accept="image/*"
                        onChange={e => handleFileChange(e, (b64) => setSettings(prev => ({...prev, backgroundImage: b64})))}
                        className="hidden"
                      />
                      <label 
                        htmlFor="bg-upload"
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold cursor-pointer hover:bg-gray-50 transition-colors text-black"
                      >
                        Fazer Upload
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase opacity-40">Ou cole o link da imagem direta</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 text-sm"
                      value={settings?.backgroundImage?.startsWith('data:image/') ? '' : (settings?.backgroundImage || '')}
                      onChange={e => setSettings(prev => ({...prev, backgroundImage: e.target.value}))}
                      placeholder="https://exemplo.com/imagem.jpg"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Nome da Marca</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={settings?.brandName || ''}
                    onChange={e => handleBrandNameChange(e.target.value)}
                    placeholder="Ex: Easy Plate Menu"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Slug da Loja (URL)</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50"
                    value={settings?.slug || ''}
                    onChange={e => setSettings({...settings, slug: slugify(e.target.value)})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">WhatsApp</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select 
                      className="p-3 rounded-xl border border-gray-300 bg-white font-bold w-full sm:w-auto"
                      value={settings?.whatsappCountryCode || '+55'}
                      onChange={e => setSettings({...settings, whatsappCountryCode: e.target.value})}
                    >
                      <option value="+55">+55 (BR)</option>
                      <option value="+1">+1 (US)</option>
                    </select>
                    <input 
                      type="text" 
                      className="flex-grow p-3 rounded-xl border border-gray-300 w-full"
                      value={settings?.whatsappNumber || ''}
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        const countryCode = settings?.whatsappCountryCode || '+55';
                        
                        if (countryCode === '+55') {
                          if (val.length > 11) val = val.slice(0, 11);
                          if (val.length > 7) val = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
                          else if (val.length > 2) val = `(${val.slice(0, 2)}) ${val.slice(2)}`;
                        } else {
                          if (val.length > 10) val = val.slice(0, 10);
                          if (val.length > 6) val = `(${val.slice(0, 3)}) ${val.slice(3, 6)}-${val.slice(6)}`;
                          else if (val.length > 3) val = `(${val.slice(0, 3)}) ${val.slice(3)}`;
                        }
                        
                        setSettings({...settings, whatsappNumber: val});
                      }}
                      placeholder={settings?.whatsappCountryCode === '+1' ? '(999) 999-9999' : '(99) 99999-9999'}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Senha do Painel Adm</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={settings?.adminPassword || ''}
                    onChange={e => setSettings({...settings, adminPassword: e.target.value})}
                    placeholder="admin123"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="text-xl font-serif font-bold">Idioma e Checkout</h3>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Título do Checkout (Abaixo de "Detalhes do Pedido")</label>
                  <textarea 
                    rows={2}
                    className="w-full p-3 rounded-xl border border-gray-300"
                    value={settings?.checkoutTitle || ''}
                    onChange={e => setSettings({...settings, checkoutTitle: e.target.value})}
                    placeholder="Ex: Ficamos muito felizes com seu pedido!..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 bg-white/50 rounded-2xl border border-gray-100">
                    <label className="text-xs font-bold uppercase opacity-60">Bloco Informativo 1</label>
                    <input 
                      type="text" 
                      className="w-full p-2 rounded-lg border border-gray-200 text-sm font-bold"
                      value={settings?.infoBlock1Title || ''}
                      onChange={e => setSettings({...settings, infoBlock1Title: e.target.value})}
                      placeholder="Título (Ex: CONFIRMAÇÃO DO PEDIDO)"
                    />
                    <textarea 
                      rows={3}
                      className="w-full p-2 rounded-lg border border-gray-200 text-sm"
                      value={settings?.infoBlock1Text || ''}
                      onChange={e => setSettings({...settings, infoBlock1Text: e.target.value})}
                      placeholder="Texto informativo..."
                    />
                  </div>
                  <div className="space-y-3 p-4 bg-white/50 rounded-2xl border border-gray-100">
                    <label className="text-xs font-bold uppercase opacity-60">Bloco Informativo 2</label>
                    <input 
                      type="text" 
                      className="w-full p-2 rounded-lg border border-gray-200 text-sm font-bold"
                      value={settings?.infoBlock2Title || ''}
                      onChange={e => setSettings({...settings, infoBlock2Title: e.target.value})}
                      placeholder="Título (Ex: RETIRADA NO LOCAL)"
                    />
                    <textarea 
                      rows={3}
                      className="w-full p-2 rounded-lg border border-gray-200 text-sm"
                      value={settings?.infoBlock2Text || ''}
                      onChange={e => setSettings({...settings, infoBlock2Text: e.target.value})}
                      placeholder="Texto informativo..."
                    />
                  </div>
                </div>
              </div>

              {/* CONFIGURAÇÃO DA TELA DE BOAS VINDAS (TELA 1) */}
              <div className="glass p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif font-bold text-lg text-black">Tela de Boas-Vindas (Apresentação)</h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings?.introEnabled !== false}
                      onChange={e => setSettings({...settings, introEnabled: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-2 text-xs font-bold uppercase opacity-65 text-black">Ativada</span>
                  </label>
                </div>
                
                {settings?.introEnabled !== false && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase opacity-50 text-black">Título Principal</label>
                        <input 
                          type="text" 
                          className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"
                          value={settings?.introTitle || ''}
                          onChange={e => setSettings({...settings, introTitle: e.target.value})}
                          placeholder="Ex: Dendê Foods"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase opacity-50 text-black">Texto do Botão</label>
                        <input 
                          type="text" 
                          className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"
                          value={settings?.introButtonText || ''}
                          onChange={e => setSettings({...settings, introButtonText: e.target.value})}
                          placeholder="Ex: INICIAR OPERAÇÃO"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50 text-black">Subtítulo Prato/Frase Cursiva</label>
                      <input 
                        type="text" 
                        className="w-full p-2.5 rounded-xl border border-gray-300 text-sm font-medium bg-white"
                        value={settings?.introSubtitle || ''}
                        onChange={e => setSettings({...settings, introSubtitle: e.target.value})}
                        placeholder="Ex: From sacred nature to your plate"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50 text-black">Texto de Apresentação (Pequeno)</label>
                      <textarea 
                        rows={2}
                        className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"
                        value={settings?.introDescription || ''}
                        onChange={e => setSettings({...settings, introDescription: e.target.value})}
                        placeholder="Ex: Descrição sobre o propósito do restaurante..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase opacity-50 text-black">Texto Inferior (Rodapé)</label>
                      <input 
                        type="text" 
                        className="w-full p-2.5 rounded-xl border border-gray-300 text-sm font-mono bg-white"
                        value={settings?.introBottomText || ''}
                        onChange={e => setSettings({...settings, introBottomText: e.target.value})}
                        placeholder="Ex: 100% ARTESANAL & AFRO-BRASILEIRO"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* CONFIGURAÇÃO DO SELETOR DE CATÁLOGOS (TELA 2) */}
              <div className="glass p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif font-bold text-lg text-black">Seletor de Catálogos / Multi-Menu</h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings?.selectorEnabled !== false}
                      onChange={e => setSettings({...settings, selectorEnabled: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-2 text-xs font-bold uppercase opacity-65 text-black">Ativado</span>
                  </label>
                </div>

                {settings?.selectorEnabled !== false && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase opacity-50 text-black">Título Superior</label>
                        <input 
                          type="text" 
                          className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"
                          value={settings?.selectorTitle || ''}
                          onChange={e => setSettings({...settings, selectorTitle: e.target.value})}
                          placeholder="Ex: Dendê Foods"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase opacity-50 text-black">Subtítulo Informativo</label>
                        <input 
                          type="text" 
                          className="w-full p-2.5 rounded-xl border border-gray-300 text-sm bg-white"
                          value={settings?.selectorSubtitle || ''}
                          onChange={e => setSettings({...settings, selectorSubtitle: e.target.value})}
                          placeholder="Ex: Escolha sua experiência"
                        />
                      </div>
                    </div>

                    {/* Configuração do Catálogo 1 */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                        <span className="text-xs font-extrabold uppercase text-gray-600">Item do Catálogo 1 (Esquerda)</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={settings?.catalog1Active !== false}
                            onChange={e => setSettings({...settings, catalog1Active: e.target.checked})}
                          />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2 space-y-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase opacity-50 text-gray-500">Nome do Catálogo 1</label>
                            <input 
                              type="text" 
                              className="w-full p-2 rounded-lg border border-gray-300 text-xs font-bold bg-white"
                              value={settings?.catalog1Title || ''}
                              onChange={e => setSettings({...settings, catalog1Title: e.target.value})}
                              placeholder="Ex: Pratos Executivos"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase opacity-50 text-gray-500">Descrição/Resumo do Catálogo 1 (Abaixo da imagem)</label>
                            <input 
                              type="text" 
                              className="w-full p-2 rounded-lg border border-gray-300 text-xs bg-white text-black"
                              value={settings?.catalog1Desc || ''}
                              onChange={e => setSettings({...settings, catalog1Desc: e.target.value})}
                              placeholder="Ex: Almoços saudáveis e pratos"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase opacity-50 text-gray-500">Slogan do Catálogo 1 (Mostrado no cabeçalho do menu)</label>
                            <textarea 
                              rows={3}
                              className="w-full p-2.5 rounded-xl border border-gray-300 text-xs bg-white text-black font-medium resize-y"
                              value={settings?.catalog1Slogan || ''}
                              onChange={e => setSettings({...settings, catalog1Slogan: e.target.value})}
                              placeholder="Ex: Coleque cada frase em uma linha para que fiquem bem formatadas de forma legível!"
                            />
                          </div>
                        </div>
                        <div className="space-y flex flex-col items-center">
                          <label className="text-[9px] font-bold uppercase opacity-50 self-start text-gray-500">Imagem de Capa</label>
                          <div className="w-full h-20 rounded-lg bg-white border border-gray-300 flex items-center justify-center overflow-hidden mb-1 shadow-sm relative">
                            {settings?.catalog1Image ? (
                              <img src={settings.catalog1Image} alt="Cover 1" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[9px] text-gray-400">Sem Imagem</span>
                            )}
                          </div>
                          <input 
                            type="file" 
                            id="catalog1-upload"
                            accept="image/*"
                            onChange={e => handleFileChange(e, (b64) => setSettings({...settings, catalog1Image: b64}))}
                            className="hidden"
                          />
                          <label 
                            htmlFor="catalog1-upload"
                            className="px-2 py-1 bg-white border border-gray-300 rounded text-[9px] font-bold cursor-pointer hover:bg-gray-50 text-black text-center w-full"
                          >
                            Selecionar
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Configuração do Catálogo 2 */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                        <span className="text-xs font-extrabold uppercase text-gray-600">Item do Catálogo 2 (Direita)</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                              className="sr-only peer" 
                              checked={settings?.catalog2Active !== false}
                              onChange={e => setSettings({...settings, catalog2Active: e.target.checked})}
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2 space-y-2">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase opacity-50 text-gray-500">Nome do Catálogo 2</label>
                              <input 
                                type="text" 
                                className="w-full p-2 rounded-lg border border-gray-300 text-xs font-bold bg-white"
                                value={settings?.catalog2Title || ''}
                                onChange={e => setSettings({...settings, catalog2Title: e.target.value})}
                                placeholder="Ex: Bebidas & Sobremesas"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase opacity-50 text-gray-500">Descrição/Resumo do Catálogo 2 (Abaixo da imagem)</label>
                              <input 
                                type="text" 
                                className="w-full p-2 rounded-lg border border-gray-300 text-xs bg-white text-black"
                                value={settings?.catalog2Desc || ''}
                                onChange={e => setSettings({...settings, catalog2Desc: e.target.value})}
                                placeholder="Ex: Sucos refrescantes, bolos e doces"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase opacity-50 text-gray-500">Slogan do Catálogo 2 (Mostrado no cabeçalho do menu)</label>
                              <textarea 
                                rows={3}
                                className="w-full p-2.5 rounded-xl border border-gray-300 text-xs bg-white text-black font-medium resize-y"
                                value={settings?.catalog2Slogan || ''}
                                onChange={e => setSettings({...settings, catalog2Slogan: e.target.value})}
                                placeholder="Ex: Coloques cada frase em uma linha para que fiquem bem formatadas de forma legível!"
                              />
                            </div>
                          </div>
                          <div className="space-y flex flex-col items-center">
                            <label className="text-[9px] font-bold uppercase opacity-50 self-start text-gray-500">Imagem de Capa</label>
                            <div className="w-full h-20 rounded-lg bg-white border border-gray-300 flex items-center justify-center overflow-hidden mb-1 shadow-sm relative">
                              {settings?.catalog2Image ? (
                                <img src={settings.catalog2Image} alt="Cover 2" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[9px] text-gray-400">Sem Imagem</span>
                              )}
                            </div>
                            <input 
                              type="file" 
                              id="catalog2-upload"
                              accept="image/*"
                              onChange={e => handleFileChange(e, (b64) => setSettings({...settings, catalog2Image: b64}))}
                              className="hidden"
                            />
                            <label 
                              htmlFor="catalog2-upload"
                              className="px-2 py-1 bg-white border border-gray-300 rounded text-[9px] font-bold cursor-pointer hover:bg-gray-50 text-black text-center w-full"
                            >
                              Selecionar
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Configuração do Catálogo 3 */}
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                          <span className="text-xs font-extrabold uppercase text-gray-600">Botão do Terceiro Catálogo (Abaixo dos cards)</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={settings?.catalog3Active !== false}
                              onChange={e => setSettings({...settings, catalog3Active: e.target.checked})}
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2 space-y-2">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase opacity-50 text-gray-500">Texto Escrito no Botão (Catálogo 3)</label>
                              <input 
                                type="text" 
                                className="w-full p-2 rounded-lg border border-gray-300 text-xs font-bold bg-white"
                                value={settings?.catalog3Title || ''}
                                onChange={e => setSettings({...settings, catalog3Title: e.target.value})}
                                placeholder="Ex: DIETAS PERSONALIZADAS"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase opacity-50 text-gray-500">Descrição/Resumo do Catálogo 3 (Abaixo do título no menu)</label>
                              <input 
                                type="text" 
                                className="w-full p-2 rounded-lg border border-gray-300 text-xs bg-white text-black"
                                value={settings?.catalog3Desc || ''}
                                onChange={e => setSettings({...settings, catalog3Desc: e.target.value})}
                                placeholder="Ex: Refeições personalizadas para sua dieta"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase opacity-50 text-gray-500">Slogan do Catálogo 3 (Mostrado no cabeçalho do menu)</label>
                              <textarea 
                                rows={3}
                                className="w-full p-2.5 rounded-xl border border-gray-300 text-xs bg-white text-black font-medium resize-y"
                                value={settings?.catalog3Slogan || ''}
                                onChange={e => setSettings({...settings, catalog3Slogan: e.target.value})}
                                placeholder="Ex: Coloques cada frase em uma linha para que fiquem bem formatadas de forma legível!"
                              />
                            </div>
                          </div>
                          <div className="space-y flex flex-col items-center">
                            <label className="text-[9px] font-bold uppercase opacity-50 self-start text-gray-500">Imagem de Capa (Circular no Menu)</label>
                            <div className="w-full h-20 rounded-lg bg-white border border-gray-300 flex items-center justify-center overflow-hidden mb-1 shadow-sm relative">
                              {settings?.catalog3Image ? (
                                <img src={settings.catalog3Image} alt="Cover 3" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[9px] text-gray-400">Sem Imagem</span>
                              )}
                            </div>
                            <input 
                              type="file" 
                              id="catalog3-upload"
                              accept="image/*"
                              onChange={e => handleFileChange(e, (b64) => setSettings({...settings, catalog3Image: b64}))}
                              className="hidden"
                            />
                            <label 
                              htmlFor="catalog3-upload"
                              className="px-2 py-1 bg-white border border-gray-300 rounded text-[9px] font-bold cursor-pointer hover:bg-gray-50 text-black text-center w-full"
                            >
                              Selecionar
                            </label>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>

              <div className="glass rounded-3xl p-8 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-2xl font-serif font-medium" style={{ color: settings?.textColor || 'inherit' }}>Seu Cardápio Digital está Online!</h3>
                  <p className="opacity-40 text-sm" style={{ color: settings?.textColor || 'inherit' }}>Compartilhe o link ou o QR Code abaixo com seus clientes:</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div className="md:col-span-2 space-y-4">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <div className="flex-grow w-full bg-white p-4 rounded-2xl font-mono text-xs break-all border border-gray-300 text-gray-900 shadow-xs">
                        {`${window.location.origin}/?slug=${settings?.slug || 'easy-cake-menu'}`}
                      </div>
                      <button 
                        onClick={copyLink}
                        className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold transition-all uppercase tracking-wider text-xs active:scale-95 text-center cursor-pointer border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 whitespace-nowrap shadow-xs"
                      >
                        {copied ? 'COPIADO!' : 'COPIAR LINK'}
                      </button>
                    </div>

                    <div className="text-xs text-gray-700 space-y-2 leading-relaxed">
                      <p>💡 <strong>Dica de Sucesso:</strong> Imprima o QR Code e coloque-o nas suas mesas, no balcão de atendimento ou nas embalagens de entrega para que os clientes acessem seu cardápio instantaneamente!</p>
                      <p>📸 Você também pode publicá-lo nos Stories do Instagram, enviar no WhatsApp ou colocar no link da sua bio.</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="p-3 bg-white rounded-xl shadow-md">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/?slug=${settings?.slug || 'easy-cake-menu'}`)}`}
                        alt="QR Code do Cardápio" 
                        className="w-32 h-32 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const appLink = `${window.location.origin}/?slug=${settings?.slug || 'easy-cake-menu'}`;
                          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(appLink)}`;
                          const response = await fetch(qrUrl);
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `qrcode-cardapio-${settings?.slug || 'menu'}.png`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                          toast.success('QR Code baixado com sucesso!');
                        } catch (error) {
                          console.error('Error downloading QR code:', error);
                          const appLink = `${window.location.origin}/?slug=${settings?.slug || 'easy-cake-menu'}`;
                          window.open(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(appLink)}`, '_blank');
                        }
                      }}
                      className="w-full py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 cursor-pointer text-black shadow-sm"
                      style={{ backgroundColor: '#efedea', color: '#000000' }}
                    >
                      <Download size={14} className="text-black" />
                      <span className="text-black">Baixar QR Code</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4 items-center">
                <button 
                  onClick={saveSettings}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold shadow-lg disabled:opacity-50"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Salvar Alterações
                </button>
                <AnimatePresence>
                  {saveSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl font-bold shadow-sm border border-green-200"
                    >
                      <CheckCircle2 size={18} /> Salvo com sucesso!
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sides' && (
          <div className="max-w-4xl space-y-8">
            <h2 className="text-3xl font-serif font-bold">Gerenciar Acompanhamentos</h2>
            
            <form onSubmit={handleAddSide} className="glass p-6 rounded-2xl space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Nome da Customização</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Troca por Quinoa"
                    className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black"
                    value={newSide.name || ''}
                    onChange={e => setNewSide({...newSide, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Tipo de Customização</label>
                  <select 
                    className="w-full p-3 rounded-xl border border-gray-300 bg-white font-bold text-gray-700"
                    value={newSide.type || 'side'}
                    onChange={e => setNewSide({...newSide, type: e.target.value as 'side' | 'swap'})}
                  >
                    <option value="side">Acompanhamento (Normal)</option>
                    <option value="swap">Troca (Swap)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase opacity-60">Preço Adicional ({currencySymbol})</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold opacity-40">{currencySymbol}</span>
                    <input 
                      type="text" 
                      className="w-full p-3 pl-10 rounded-xl border border-gray-300 bg-white text-black"
                      value={sidePriceInput}
                      onChange={e => handleSidePriceChange(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  type="submit"
                  className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isEditingSide ? <Save size={20} /> : <Plus size={20} />}
                  {isEditingSide ? 'Salvar' : 'Adicionar'}
                </button>
                {isEditingSide && (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditingSide(null);
                      setNewSide({ name: '', price: 0, type: 'side' });
                      setSidePriceInput('');
                    }}
                    className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gray-200 font-bold cursor-pointer text-black"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sides.map(side => (
                <div key={side.id} className="glass p-4 rounded-xl flex items-center justify-between group">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-bold text-black">{side.name}</div>
                      <span className={cn(
                        "text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border",
                        side.type === 'swap' 
                          ? "bg-amber-100 text-amber-800 border-amber-200" 
                          : "bg-blue-100 text-blue-800 border-blue-200"
                      )}>
                        {side.type === 'swap' ? 'Troca (Swap)' : 'Acompanhamento'}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-gray-900">{currencySymbol} {side.price.toFixed(2).replace('.', ',')}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsEditingSide(side);
                        setNewSide(side);
                        setSidePriceInput(side.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                        const mainElem = document.getElementById('admin-main-content') || document.querySelector('main');
                        if (mainElem) mainElem.scrollTo({ top: 0, behavior: 'smooth' });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="p-2 bg-white/90 hover:bg-blue-50 text-blue-600 rounded-xl shadow-xs border border-gray-200 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                      title="Editar Acompanhamento"
                    >
                      <Edit2 size={16} />
                      <span className="hidden sm:inline">Editar</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => deleteSide(side.id)}
                      className="p-2 bg-white/90 hover:bg-red-50 text-red-600 rounded-xl shadow-xs border border-gray-200 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                      title="Excluir Acompanhamento"
                    >
                      <Trash2 size={16} />
                      <span className="hidden sm:inline">Excluir</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {activeTab === 'categories' && (
          <div className="max-w-4xl space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-serif font-bold">Gerenciar Categorias</h2>
                <p className="text-sm text-gray-600 mt-1">Organize as categorias e separe a visualização por cada cardápio.</p>
              </div>
            </div>
            
            <form onSubmit={handleAddCategory} className="bg-white/95 backdrop-blur-md p-6 rounded-2xl border border-gray-200/80 shadow-md flex flex-col gap-4">
              <h3 className="text-base font-bold text-gray-900">
                {isEditingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <input 
                  type="text" 
                  placeholder="Nome da categoria (Ex: Pratos Executivos)"
                  className="flex-grow p-3 rounded-xl border border-gray-300 w-full bg-white text-gray-900"
                  value={newCategory.title || ''}
                  onChange={e => setNewCategory({...newCategory, title: e.target.value})}
                  required
                />
                <select
                  className="p-3 rounded-xl border border-gray-300 bg-white font-bold text-gray-700 sm:w-64"
                  value={newCategory.catalog || 'both'}
                  onChange={e => setNewCategory({...newCategory, catalog: e.target.value as any})}
                >
                  <option value="both">Compartilhado ({settings?.catalog1Title || 'Cardápio 1'} & {settings?.catalog2Title || 'Cardápio 2'})</option>
                  <option value="catalog1">Apenas em {settings?.catalog1Title || 'Cardápio 1'}</option>
                  <option value="catalog2">Apenas em {settings?.catalog2Title || 'Cardápio 2'}</option>
                  {settings?.catalog3Title && (
                    <option value="catalog3">Apenas em {settings.catalog3Title}</option>
                  )}
                  <option value="all">Em Todos os Cardápios</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button 
                  type="submit"
                  className="px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isEditingCategory ? <Save size={20} /> : <Plus size={20} />}
                  {isEditingCategory ? 'Salvar Alterações' : 'Adicionar Categoria'}
                </button>
                {isEditingCategory && (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditingCategory(null);
                      setNewCategory({ title: '', order: 0, catalog: 'both' });
                    }}
                    className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold cursor-pointer text-black transition-all"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            {/* BARRA DE FILTRO / VISUALIZAÇÃO POR CARDÁPIO */}
            <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                <Filter size={15} /> Visualizar Categorias:
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryCatalogFilter('all')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    categoryCatalogFilter === 'all'
                      ? "bg-gray-900 text-white shadow-sm"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  )}
                >
                  Todos os Cardápios ({categories.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryCatalogFilter('catalog1')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    categoryCatalogFilter === 'catalog1'
                      ? "bg-gray-900 text-white shadow-sm"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  )}
                >
                  {settings?.catalog1Title || 'Cardápio 1'} ({categories.filter(c => c.catalog === 'catalog1').length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryCatalogFilter('catalog2')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    categoryCatalogFilter === 'catalog2'
                      ? "bg-gray-900 text-white shadow-sm"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  )}
                >
                  {settings?.catalog2Title || 'Cardápio 2'} ({categories.filter(c => c.catalog === 'catalog2').length})
                </button>
                {(settings?.catalog3Title || categories.some(c => c.catalog === 'catalog3')) && (
                  <button
                    type="button"
                    onClick={() => setCategoryCatalogFilter('catalog3')}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      categoryCatalogFilter === 'catalog3'
                        ? "bg-gray-900 text-white shadow-sm"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    )}
                  >
                    {settings?.catalog3Title || 'Cardápio 3'} ({categories.filter(c => c.catalog === 'catalog3').length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCategoryCatalogFilter('shared')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    categoryCatalogFilter === 'shared'
                      ? "bg-gray-900 text-white shadow-sm"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  )}
                >
                  Compartilhadas ({categories.filter(c => c.catalog === 'both' || c.catalog === 'all' || !c.catalog).length})
                </button>
              </div>
            </div>

            {/* LISTAGEM ORGANIZADA E SEPARADA POR CARDÁPIO */}
            <div className="space-y-8">
              {(() => {
                const catalogSections = [
                  {
                    key: 'catalog1',
                    title: settings?.catalog1Title || 'Cardápio 1',
                    badge: settings?.catalog1Title || 'Cardápio 1',
                    items: categories.filter(c => c.catalog === 'catalog1')
                  },
                  {
                    key: 'catalog2',
                    title: settings?.catalog2Title || 'Cardápio 2',
                    badge: settings?.catalog2Title || 'Cardápio 2',
                    items: categories.filter(c => c.catalog === 'catalog2')
                  },
                  ...(settings?.catalog3Title || categories.some(c => c.catalog === 'catalog3') ? [{
                    key: 'catalog3',
                    title: settings?.catalog3Title || 'Cardápio 3',
                    badge: settings?.catalog3Title || 'Cardápio 3',
                    items: categories.filter(c => c.catalog === 'catalog3')
                  }] : []),
                  {
                    key: 'shared',
                    title: `Categorias Compartilhadas (${[settings?.catalog1Title, settings?.catalog2Title].filter(Boolean).join(' & ') || 'Todos os Cardápios'})`,
                    badge: 'Compartilhadas',
                    items: categories.filter(c => c.catalog === 'both' || c.catalog === 'all' || !c.catalog)
                  }
                ];

                const filteredSections = catalogSections.filter(sec => {
                  if (categoryCatalogFilter === 'all') return true;
                  return sec.key === categoryCatalogFilter;
                });

                return filteredSections.map(sec => {
                  return (
                    <div 
                      key={sec.key} 
                      className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-gray-200/80 shadow-md space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-serif font-bold text-gray-900">
                            {sec.title}
                          </h3>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {sec.badge}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-gray-500">
                            {sec.items.length} {sec.items.length === 1 ? 'categoria' : 'categorias'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewCategory({ title: '', order: 0, catalog: (sec.key === 'shared' ? 'both' : sec.key) as any });
                              setIsEditingCategory(null);
                              const form = document.querySelector('form');
                              if (form) form.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={14} /> Adicionar nesta seção
                          </button>
                        </div>
                      </div>

                      {sec.items.length === 0 ? (
                        <p className="text-sm italic text-gray-400 py-3 text-center">
                          Nenhuma categoria cadastrada exclusivamente para este cardápio.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {sec.items.map((cat, idx) => {
                            const isFirst = idx === 0;
                            const isLast = idx === sec.items.length - 1;
                            const prodCount = products.filter(p => p.categoryId === cat.id).length;

                            return (
                              <motion.div 
                                layout
                                key={cat.id} 
                                className="bg-gray-50/90 hover:bg-gray-100/90 p-4 rounded-xl flex items-center justify-between border border-gray-200/80 shadow-xs transition-all"
                              >
                                <div className="flex items-center gap-4 min-w-0">
                                  <div className="flex flex-col gap-1">
                                    <button 
                                      onClick={() => moveCategoryInCatalog(cat.id, 'up', sec.items)}
                                      disabled={isFirst}
                                      className="p-1 bg-white hover:bg-gray-200 text-gray-700 rounded border border-gray-200 disabled:opacity-20 cursor-pointer shadow-2xs"
                                      title="Mover para cima"
                                    >
                                      <ArrowUp size={14} />
                                    </button>
                                    <button 
                                      onClick={() => moveCategoryInCatalog(cat.id, 'down', sec.items)}
                                      disabled={isLast}
                                      className="p-1 bg-white hover:bg-gray-200 text-gray-700 rounded border border-gray-200 disabled:opacity-20 cursor-pointer shadow-2xs"
                                      title="Mover para baixo"
                                    >
                                      <ArrowDown size={14} />
                                    </button>
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-base text-gray-900 truncate">{cat.title}</span>
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                                        {prodCount} {prodCount === 1 ? 'produto' : 'produtos'}
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-gray-500 font-medium block mt-0.5">
                                      Ordem #{idx + 1}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setIsEditingCategory(cat);
                                      setNewCategory({ title: cat.title, order: cat.order || 0, catalog: (cat.catalog || 'both') as any });
                                      const mainElem = document.getElementById('admin-main-content') || document.querySelector('main');
                                      if (mainElem) mainElem.scrollTo({ top: 0, behavior: 'smooth' });
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="p-2 bg-white hover:bg-blue-50 text-blue-600 rounded-xl shadow-xs border border-gray-200 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                                    title="Editar Categoria"
                                  >
                                    <Edit2 size={16} />
                                    <span className="hidden sm:inline">Editar</span>
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => deleteCategory(cat.id)}
                                    className="p-2 bg-white hover:bg-red-50 text-red-600 rounded-xl shadow-xs border border-gray-200 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                                    title="Excluir Categoria"
                                  >
                                    <Trash2 size={16} />
                                    <span className="hidden sm:inline">Excluir</span>
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-serif font-bold">Gerenciar Cardápio</h2>
            </div>

            <form id="product-form-card" onSubmit={handleAddProduct} className="bg-white/95 backdrop-blur-md p-8 rounded-2xl space-y-6 text-gray-900 border border-gray-200/90 shadow-md">
              <h3 className="text-xl font-serif font-bold text-gray-900">{isEditingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase text-gray-700 opacity-90">Título do Produto</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white"
                      value={newProduct.title || ''}
                      onChange={e => setNewProduct({...newProduct, title: e.target.value})}
                      placeholder="Ex: Prato Executivo de Frango"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase text-gray-700 opacity-90">Descrição</label>
                    <textarea 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white"
                      rows={3}
                      value={newProduct.description}
                      onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                      placeholder="Detalhes do produto..."
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold uppercase text-gray-700 opacity-90">Preço Original (De) ({currencySymbol})</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold opacity-50 text-gray-600">{currencySymbol}</span>
                        <input 
                          type="text" 
                          className="w-full p-3 pl-10 rounded-xl border border-gray-300 bg-white"
                          value={oldPriceInput}
                          onChange={e => handleOldPriceChange(e.target.value)}
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold uppercase text-gray-700 opacity-90">Preço Promocional (Por) ({currencySymbol})</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold opacity-50 text-gray-600">{currencySymbol}</span>
                        <input 
                          type="text" 
                          className="w-full p-3 pl-10 rounded-xl border border-gray-300 bg-white"
                          value={priceInput}
                          onChange={e => handlePriceChange(e.target.value)}
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase text-gray-700 opacity-90">Categoria</label>
                    {categories.length === 0 ? (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2 text-black">
                        <p className="text-xs text-red-700 font-bold leading-relaxed">
                          ⚠️ Nenhuma categoria cadastrada. Crie uma abaixo para poder cadastrar produtos:
                        </p>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Ex: Hambúrgueres, Bebidas..." 
                            className="flex-grow p-2 text-xs rounded-lg border border-red-300 bg-white text-black"
                            id="quick-category-input"
                          />
                          <button 
                            type="button" 
                            onClick={async () => {
                              const input = document.getElementById('quick-category-input') as HTMLInputElement;
                              if (!input || !input.value.trim()) {
                                toast.error('Digite o nome da categoria.');
                                return;
                              }
                              const title = input.value.trim();
                              try {
                                await addDoc(collection(db, 'categorias'), {
                                  title,
                                  order: 0,
                                  catalog: 'both'
                                });
                                toast.success('Categoria adicionada com sucesso!');
                              } catch (err) {
                                toast.error('Erro ao adicionar categoria.');
                              }
                            }}
                            className="px-3 py-2 bg-[#865d39] text-white text-xs font-bold rounded-lg hover:brightness-110 transition-all flex items-center gap-1"
                          >
                            <Plus size={12} /> Criar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <select 
                        className="w-full p-3 rounded-xl border border-gray-300 bg-white text-black font-sans"
                        value={newProduct.categoryId}
                        onChange={e => setNewProduct({...newProduct, categoryId: e.target.value})}
                      >
                        <option value="">Selecionar categoria...</option>
                        {categories.map(cat => {
                          const catName = cat.catalog === 'catalog1' 
                            ? (settings?.catalog1Title || 'Cardápio 1') 
                            : cat.catalog === 'catalog2' 
                              ? (settings?.catalog2Title || 'Cardápio 2') 
                              : cat.catalog === 'catalog3'
                                ? (settings?.catalog3Title || 'Cardápio 3')
                                : cat.catalog === 'all'
                                  ? 'Todos os Cardápios'
                                  : `Compartilhado (${[settings?.catalog1Title, settings?.catalog2Title].filter(Boolean).join(' & ') || 'Ambos'})`;
                          return (
                            <option key={cat.id} value={cat.id}>
                              {cat.title} — ({catName})
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase text-gray-700 opacity-90">Imagem do Produto</label>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                        {newProduct.image ? (
                          <img src={newProduct.image} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <ImageIcon className="text-gray-300" size={32} />
                        )}
                      </div>
                      <input 
                        type="file" 
                        id="product-image"
                        accept="image/*"
                        onChange={e => handleFileChange(e, (b64) => setNewProduct({...newProduct, image: b64}))}
                        className="hidden"
                      />
                      <label 
                        htmlFor="product-image"
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold cursor-pointer hover:bg-gray-50 transition-colors text-black font-sans"
                      >
                        Selecionar Imagem
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 p-4 bg-white/50 rounded-2xl border border-gray-100">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-gray-300"
                        checked={newProduct.isCustomCake || false}
                        onChange={e => setNewProduct({...newProduct, isCustomCake: e.target.checked})}
                      />
                      <span className="font-bold text-sm text-gray-800">Bolo Personalizado (Bolo de Festa)</span>
                    </label>

                    {newProduct.isCustomCake && (
                      <div className="space-y-4 pl-8 pt-1">
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] font-bold uppercase opacity-60 text-black">Vincular Galeria de Estilos (Opcional)</label>
                          <select
                            value={newProduct.cakeGalleryId || ''}
                            onChange={e => setNewProduct({...newProduct, cakeGalleryId: e.target.value})}
                            className="p-2.5 rounded-xl border border-gray-300 text-sm font-bold bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500/20 max-w-sm cursor-pointer"
                          >
                            <option value="">Nenhuma galeria vinculada</option>
                            {galleries.map(gal => (
                              <option key={gal.id} value={gal.id}>{gal.name}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-gray-500 font-semibold leading-normal mt-0.5">
                            Escolha uma galeria de fotos para o cliente selecionar uma imagem como referência da decoração do bolo no menu.
                          </p>
                        </div>
                      </div>
                    )}

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-gray-300"
                        checked={newProduct.isCustomSandwich || false}
                        onChange={e => setNewProduct({...newProduct, isCustomSandwich: e.target.checked})}
                      />
                      <span className="font-bold text-sm text-gray-800">Montagem Personalizada (Tapiocas / Sanduíches)</span>
                    </label>

                    {newProduct.isCustomSandwich && (
                      <div className="space-y-4 pl-8 pt-1 text-black">
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] font-bold uppercase opacity-60 text-black">Recheios Disponíveis (Separados por vírgula)</label>
                          <input 
                            type="text" 
                            className="w-full p-2.5 rounded-xl border border-gray-300 text-sm font-semibold bg-white text-black focus:outline-none"
                            value={newProduct.customFillings || ''}
                            onChange={e => setNewProduct({...newProduct, customFillings: e.target.value})}
                            placeholder="Ex: Queijo Mussarela, Presunto, Goiabada, Doce de Leite"
                          />
                          <p className="text-[10px] text-gray-500 font-semibold leading-normal mt-0.5">
                            Digite os recheios disponíveis separados por vírgula. A quantidade máxima de recheios que o cliente poderá escolher será definida pelo número no nome da variação (ex: se o cliente selecionar a variação "1 Recheio", ele poderá escolher até 1 recheio; "2 Recheios" até 2, etc.).
                          </p>
                        </div>
                      </div>
                    )}

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-gray-300"
                        checked={newProduct.isMeal}
                        onChange={e => setNewProduct({...newProduct, isMeal: e.target.checked})}
                      />
                      <span className="font-bold text-sm text-gray-800">Habilitar Opções de Personalização (Marmitas)</span>
                    </label>
                    
                    {newProduct.isMeal && (
                      <div className="space-y-4 pl-8">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase opacity-60">Itens para Exclusão (Separados por vírgula)</label>
                          <input 
                            type="text" 
                            className="w-full p-2 rounded-lg border border-gray-300 text-sm"
                            value={newProduct.ingredients || ''}
                            onChange={e => setNewProduct({...newProduct, ingredients: e.target.value})}
                            placeholder="Ex: Cebola, Alho, Pimenta"
                          />
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase opacity-60">Acompanhamentos Permitidos</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {sides.filter(s => s.type !== 'swap').map(side => (
                                <label key={side.id} className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    checked={newProduct.allowedSides?.includes(side.id)}
                                    onChange={e => {
                                      const current = newProduct.allowedSides || [];
                                      if (e.target.checked) {
                                        setNewProduct({...newProduct, allowedSides: [...current, side.id]});
                                      } else {
                                        setNewProduct({...newProduct, allowedSides: current.filter(id => id !== side.id)});
                                      }
                                    }}
                                  />
                                  <span className="text-xs text-black">{side.name}</span>
                                </label>
                              ))}
                              {sides.filter(s => s.type !== 'swap').length === 0 && (
                                <span className="text-xs opacity-40">Nenhum cadastrado</span>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase opacity-60 text-amber-800">Opções de Troca Permitidas (Swap)</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {sides.filter(s => s.type === 'swap').map(side => (
                                <label key={side.id} className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    checked={newProduct.allowedSides?.includes(side.id)}
                                    onChange={e => {
                                      const current = newProduct.allowedSides || [];
                                      if (e.target.checked) {
                                        setNewProduct({...newProduct, allowedSides: [...current, side.id]});
                                      } else {
                                        setNewProduct({...newProduct, allowedSides: current.filter(id => id !== side.id)});
                                      }
                                    }}
                                  />
                                  <span className="text-xs text-black">{side.name}</span>
                                </label>
                              ))}
                              {sides.filter(s => s.type === 'swap').length === 0 && (
                                <span className="text-xs opacity-40">Nenhuma cadastrada</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <label className="flex items-center gap-3 cursor-pointer mt-3 pt-3 border-t border-gray-200">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-gray-300"
                        checked={!!newProduct.hasSizes}
                        onChange={e => {
                          const checked = e.target.checked;
                          setNewProduct({
                            ...newProduct,
                            hasSizes: checked,
                            sizes: newProduct.sizes || []
                          });
                        }}
                      />
                      <span className="font-bold text-sm text-gray-800">Habilitar Múltiplos Tamanhos, Quantidades ou Preços (Variações)</span>
                    </label>

                    {newProduct.hasSizes && (
                      <div className="space-y-4 pl-8 mt-2 text-black">
                        <div className="bg-white/40 p-4 rounded-xl border border-gray-200 space-y-3">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-900 opacity-95">Adicionar Tamanho/Preço</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase text-gray-700 opacity-90">Nome da Opção</label>
                              <input 
                                type="text"
                                placeholder="Ex: Pequeno / 10 Pessoas"
                                className="w-full p-2 text-xs rounded-lg border border-gray-300 bg-white text-black font-sans"
                                value={sizeForm.name}
                                onChange={e => setSizeForm({ ...sizeForm, name: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase text-gray-700 opacity-90">Preço ({currencySymbol})</label>
                              <input 
                                type="text"
                                placeholder="0,00"
                                className="w-full p-2 text-xs rounded-lg border border-gray-300 bg-white text-black font-sans"
                                value={sizeForm.price}
                                onChange={e => {
                                  const digits = e.target.value.replace(/\D/g, '');
                                  if (!digits) {
                                    setSizeForm({ ...sizeForm, price: '' });
                                    return;
                                  }
                                  const val = parseInt(digits) / 100;
                                  setSizeForm({ ...sizeForm, price: val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) });
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleAddSizeOption}
                              className="flex-grow py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                            >
                              {editingSizeId ? (
                                <>
                                  <Save size={14} /> Salvar Alterações
                                </>
                              ) : (
                                <>
                                  <Plus size={14} /> Adicionar Opção de Tamanho
                                </>
                              )}
                            </button>
                            {editingSizeId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSizeId(null);
                                  setSizeForm({ name: '', price: '', oldPrice: '' });
                                }}
                                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>

                        {/* List of defined sizes */}
                        <div className="space-y-2">
                          {(newProduct.sizes || []).map((size, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3.5 bg-white/60 rounded-xl border border-gray-200">
                              <div>
                                <span className="font-bold text-xs text-black block">{size.name}</span>
                                <span className="text-[10px] text-gray-700 font-mono">
                                  Preço: {size.price && size.price > 0 ? `${currencySymbol} ${size.price.toFixed(2).replace('.', ',')}` : 'Sob Consulta (Sem valor)'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSizeId(size.id);
                                    setSizeForm({
                                      name: size.name,
                                      price: (size.price && size.price > 0) ? size.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
                                      oldPrice: ''
                                    });
                                  }}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-800 rounded-lg transition-colors cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (editingSizeId === size.id) {
                                      setEditingSizeId(null);
                                      setSizeForm({ name: '', price: '', oldPrice: '' });
                                    }
                                    setNewProduct({
                                      ...newProduct,
                                      sizes: (newProduct.sizes || []).filter((_, sIdx) => sIdx !== idx)
                                    });
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-800 rounded-lg transition-colors cursor-pointer"
                                  title="Excluir"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                          {(newProduct.sizes || []).length === 0 && (
                            <div className="text-center p-4 bg-gray-50/20 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500">
                              Nenhum tamanho adicionado ainda. É necessário adicionar pelo menos 1 tamanho.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  type="submit"
                  className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isEditingProduct ? <Save size={20} /> : <Plus size={20} />}
                  {isEditingProduct ? 'Salvar Alterações' : 'Adicionar ao Cardápio'}
                </button>
                {isEditingProduct && (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditingProduct(null);
                      setNewProduct({ 
                        title: '', description: '', price: 0, oldPrice: 0, priceType: 'fixed',
                        image: '', categoryId: '', isMeal: true, isCustomCake: false, isCustomSandwich: false, customFillings: '', ingredients: '', allowedSides: [], isActive: true,
                        hasSizes: false, sizes: []
                      });
                      setPriceInput('');
                      setOldPriceInput('');
                      setEditingSizeId(null);
                      setSizeForm({ name: '', price: '', oldPrice: '' });
                    }}
                    className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gray-200 font-bold text-black cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 border border-gray-200/90 shadow-sm">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar produto pelo nome..."
                  className="w-full p-3 pl-10 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={printAllProductsList}
                className="w-full md:w-auto px-6 py-3 rounded-xl bg-gray-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Printer size={18} /> Imprimir Todos os Produtos
              </button>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center p-12 bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200/90 shadow-sm">
                <p className="text-gray-600 font-bold">Nenhum produto encontrado com a pesquisa atual.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(product => (
                  <motion.div 
                    layout
                    key={product.id} 
                    className={cn(
                      "bg-white/95 backdrop-blur-md rounded-2xl overflow-hidden flex flex-col border border-gray-200/90 shadow-md transition-all text-gray-900 hover:shadow-lg",
                      product.isActive === false ? "opacity-60 grayscale bg-gray-100/95" : ""
                    )}
                  >
                    <div className="h-48 relative">
                      <img src={product.image} alt={product.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute top-3 right-3 flex gap-2">
                        <button 
                          onClick={() => toggleProductStatus(product)}
                          className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm text-gray-700 hover:text-black"
                          title={product.isActive === false ? "Ativar" : "Desativar"}
                        >
                          {product.isActive === false ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                        <button 
                          onClick={() => {
                            setIsEditingProduct(product);
                            setNewProduct({
                              title: product.title,
                              description: product.description,
                              price: product.price,
                              oldPrice: product.oldPrice || 0,
                              priceType: product.priceType || 'fixed',
                              image: product.image,
                              categoryId: product.categoryId,
                              isMeal: product.isMeal || false,
                              isCustomCake: product.isCustomCake || false,
                              isCustomSandwich: product.isCustomSandwich || false,
                              customFillings: product.customFillings || '',
                              ingredients: product.ingredients || '',
                              allowedSides: product.allowedSides || [],
                              isActive: product.isActive ?? true,
                              hasSizes: product.hasSizes || false,
                              sizes: product.sizes || [],
                              cakeGalleryId: product.cakeGalleryId || ''
                            });
                            setPriceInput(product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                            setEditingSizeId(null);
                            setSizeForm({ name: '', price: '', oldPrice: '' });
                            setOldPriceInput(product.oldPrice ? product.oldPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
                            
                            // Scroll smooth to top of form
                            const mainElem = document.getElementById('admin-main-content') || document.querySelector('main');
                            if (mainElem) {
                              mainElem.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            const formElem = document.getElementById('product-form-card');
                            if (formElem) {
                              formElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm text-blue-600 hover:bg-blue-50 cursor-pointer"
                          title="Editar Produto"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => deleteProduct(product.id)}
                          className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm text-red-600"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="p-5 flex-grow flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-serif font-bold text-lg text-gray-900">{product.title}</h4>
                        <div className="flex flex-col items-end">
                          {product.sizes && product.sizes.length > 0 ? (
                            <>
                              <span className="text-[10px] font-bold uppercase text-gray-500">Tamanhos múltiplos</span>
                              <span className="font-bold text-blue-600">
                                A partir de: {currencySymbol} {Math.min(...product.sizes.map(s => s.price)).toFixed(2).replace('.', ',')}
                              </span>
                            </>
                          ) : (
                            <>
                              {product.price > 0 && product.oldPrice && product.oldPrice > 0 && (
                                <span className="text-xs line-through text-gray-400">
                                  {currencySymbol} {product.oldPrice.toFixed(2).replace('.', ',')}
                                </span>
                              )}
                              <span className="font-bold text-blue-600">
                                {currencySymbol} {(product.price > 0 ? product.price : (product.oldPrice || 0)).toFixed(2).replace('.', ',')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                      
                      {product.sizes && product.sizes.length > 0 && (
                        <div className="bg-gray-100 p-2 rounded-xl text-[11px] space-y-1 mt-2 border border-gray-200/60">
                          <span className="font-bold text-gray-700">Tamanhos:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {product.sizes.map((s, idx) => (
                              <span key={idx} className="bg-white px-2 py-0.5 rounded border border-gray-200 font-medium text-gray-900 shadow-xs">
                                {s.name} ({currencySymbol} {s.price.toFixed(2).replace('.', ',')})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-auto pt-3 flex items-center justify-between border-t border-gray-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          {categories.find(c => c.id === product.categoryId)?.title || 'Sem categoria'}
                        </span>
                        <div className="flex gap-1.5">
                          {product.isMeal && (
                            <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-full uppercase">
                              Opções de Personalização
                            </span>
                          )}
                          {product.sizes && product.sizes.length > 0 && (
                            <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase">
                              Múltiplos Tamanhos
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reorderProducts' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-serif font-bold flex items-center gap-3">
                  <ArrowUpDown className="text-[#865d39]" size={28} />
                  Organizar Itens do Cardápio
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Defina a ordem exata de exibição dos itens em cada categoria. Os produtos no topo aparecerão primeiro para os clientes.
                </p>
              </div>
              {isSavingProductOrder && (
                <div className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl border border-blue-200">
                  <Loader2 size={16} className="animate-spin" /> Salvando ordem...
                </div>
              )}
            </div>

            {/* Filter & Controls Bar */}
            <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                  <Filter size={14} /> Filtrar por Cardápio:
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReorderCatalogFilter('all');
                      setReorderSelectedCategory('all');
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      reorderCatalogFilter === 'all'
                        ? "bg-gray-900 text-white shadow-sm"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    )}
                  >
                    Todos os Cardápios
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReorderCatalogFilter('catalog1');
                      setReorderSelectedCategory('all');
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      reorderCatalogFilter === 'catalog1'
                        ? "bg-gray-900 text-white shadow-sm"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    )}
                  >
                    {settings?.catalog1Title || 'Cardápio 1'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReorderCatalogFilter('catalog2');
                      setReorderSelectedCategory('all');
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      reorderCatalogFilter === 'catalog2'
                        ? "bg-gray-900 text-white shadow-sm"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    )}
                  >
                    {settings?.catalog2Title || 'Cardápio 2'}
                  </button>
                  {(settings?.catalog3Title || categories.some(c => c.catalog === 'catalog3')) && (
                    <button
                      type="button"
                      onClick={() => {
                        setReorderCatalogFilter('catalog3');
                        setReorderSelectedCategory('all');
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                        reorderCatalogFilter === 'catalog3'
                          ? "bg-gray-900 text-white shadow-sm"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      )}
                    >
                      {settings?.catalog3Title || 'Cardápio 3'}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-grow md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Filtrar por produto..."
                    className="w-full p-2 pl-9 rounded-xl border border-gray-300 text-xs bg-white text-gray-900"
                    value={reorderSearchQuery}
                    onChange={e => setReorderSearchQuery(e.target.value)}
                  />
                  {reorderSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setReorderSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Category Jump Bar */}
            {(() => {
              const eligibleCategories = categories.filter(c => {
                if (reorderCatalogFilter === 'catalog1') {
                  return c.catalog === 'catalog1' || c.catalog === 'both' || c.catalog === 'all' || !c.catalog;
                }
                if (reorderCatalogFilter === 'catalog2') {
                  return c.catalog === 'catalog2' || c.catalog === 'both' || c.catalog === 'all' || !c.catalog;
                }
                if (reorderCatalogFilter === 'catalog3') {
                  return c.catalog === 'catalog3' || c.catalog === 'all';
                }
                return true;
              });

              return (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setReorderSelectedCategory('all')}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0",
                      reorderSelectedCategory === 'all'
                        ? "bg-gray-900 text-white shadow-sm"
                        : "bg-white/90 hover:bg-white text-gray-700 border border-gray-200"
                    )}
                  >
                    Todas as Categorias ({eligibleCategories.length})
                  </button>
                  {eligibleCategories.map(cat => {
                    const count = products.filter(p => p.categoryId === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setReorderSelectedCategory(cat.id)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5",
                          reorderSelectedCategory === cat.id
                            ? "bg-gray-900 text-white shadow-sm"
                            : "bg-white/90 hover:bg-white text-gray-700 border border-gray-200"
                        )}
                      >
                        <span>{cat.title}</span>
                        <span className={cn(
                          "px-1.5 py-0.2 rounded-full text-[10px]",
                          reorderSelectedCategory === cat.id ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
                        )}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Render categories & their sortable products */}
            {(() => {
              const eligibleCategories = categories
                .filter(c => {
                  if (reorderCatalogFilter === 'catalog1') {
                    return c.catalog === 'catalog1' || c.catalog === 'both' || c.catalog === 'all' || !c.catalog;
                  }
                  if (reorderCatalogFilter === 'catalog2') {
                    return c.catalog === 'catalog2' || c.catalog === 'both' || c.catalog === 'all' || !c.catalog;
                  }
                  if (reorderCatalogFilter === 'catalog3') {
                    return c.catalog === 'catalog3' || c.catalog === 'all';
                  }
                  return true;
                })
                .filter(c => {
                  if (reorderSelectedCategory === 'all') return true;
                  return c.id === reorderSelectedCategory;
                });

              if (eligibleCategories.length === 0) {
                return (
                  <div className="p-12 text-center bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200/80 shadow-sm">
                    <Layers className="mx-auto text-gray-400 mb-3" size={32} />
                    <p className="font-bold text-gray-600">Nenhuma categoria encontrada para o filtro selecionado.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {eligibleCategories.map(cat => {
                    const catProducts = products
                      .filter(p => p.categoryId === cat.id)
                      .sort((a, b) => {
                        const orderA = typeof a.order === 'number' ? a.order : 9999;
                        const orderB = typeof b.order === 'number' ? b.order : 9999;
                        if (orderA !== orderB) return orderA - orderB;
                        return a.title.localeCompare(b.title);
                      })
                      .filter(p => {
                        if (!reorderSearchQuery.trim()) return true;
                        return p.title.toLowerCase().includes(reorderSearchQuery.toLowerCase());
                      });

                    return (
                      <div 
                        key={cat.id} 
                        className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-gray-200/80 shadow-md space-y-4"
                      >
                        {/* Header da Categoria */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-serif font-bold text-gray-900">
                              {cat.title}
                            </h3>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                              {cat.catalog === 'catalog1' 
                                ? (settings?.catalog1Title || 'Cardápio 1') 
                                : cat.catalog === 'catalog2' 
                                  ? (settings?.catalog2Title || 'Cardápio 2') 
                                  : cat.catalog === 'catalog3'
                                    ? (settings?.catalog3Title || 'Cardápio 3')
                                    : cat.catalog === 'all'
                                      ? 'Todos os Cardápios'
                                      : `Compartilhado (${[settings?.catalog1Title, settings?.catalog2Title].filter(Boolean).join(' & ') || 'Ambos'})`}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-gray-500">
                            {catProducts.length} {catProducts.length === 1 ? 'item cadastrado' : 'itens cadastrados'}
                          </div>
                        </div>

                        {/* Lista de Produtos */}
                        {catProducts.length === 0 ? (
                          <p className="text-sm italic text-gray-400 py-3 text-center">
                            Nenhum produto cadastrado nesta categoria.
                          </p>
                        ) : (
                          <div className="space-y-2.5">
                            {catProducts.map((product, pIdx) => {
                              const isFirst = pIdx === 0;
                              const isLast = pIdx === catProducts.length - 1;

                              return (
                                <motion.div
                                  layout
                                  key={product.id}
                                  className={cn(
                                    "flex items-center justify-between p-3.5 rounded-xl border transition-all",
                                    product.isActive === false 
                                      ? "bg-gray-100/80 border-gray-300 opacity-60" 
                                      : "bg-gray-50/90 hover:bg-gray-100/90 border-gray-200 shadow-xs"
                                  )}
                                >
                                  {/* Info do Produto */}
                                  <div className="flex items-center gap-3.5 min-w-0 flex-grow pr-4">
                                    <div className="w-8 h-8 rounded-lg bg-gray-200/80 flex items-center justify-center font-bold text-xs text-gray-700 shrink-0 shadow-xs border border-gray-300">
                                      #{pIdx + 1}
                                    </div>

                                    {product.image ? (
                                      <img 
                                        src={product.image} 
                                        alt={product.title} 
                                        className="w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0" 
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 text-gray-400">
                                        <Package size={20} />
                                      </div>
                                    )}

                                    <div className="min-w-0 flex-grow">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-sm text-gray-900 truncate">
                                          {product.title}
                                        </h4>
                                        {product.isActive === false && (
                                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-red-100 text-red-600 rounded">
                                            Inativo
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500 font-semibold mt-0.5">
                                        {currencySymbol} {product.price > 0 ? product.price.toFixed(2).replace('.', ',') : (product.oldPrice || 0).toFixed(2).replace('.', ',')}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Botões de Ordenação */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => moveProductToExtreme(cat.id, product.id, 'top')}
                                      disabled={isFirst || isSavingProductOrder}
                                      className="p-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg disabled:opacity-20 cursor-pointer transition-all shadow-xs"
                                      title="Mover para o Topo"
                                    >
                                      <ChevronsUp size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveProductInCategory(cat.id, product.id, 'up')}
                                      disabled={isFirst || isSavingProductOrder}
                                      className="p-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg disabled:opacity-20 cursor-pointer transition-all shadow-xs"
                                      title="Mover para Cima"
                                    >
                                      <ArrowUp size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveProductInCategory(cat.id, product.id, 'down')}
                                      disabled={isLast || isSavingProductOrder}
                                      className="p-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg disabled:opacity-20 cursor-pointer transition-all shadow-xs"
                                      title="Mover para Baixo"
                                    >
                                      <ArrowDown size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveProductToExtreme(cat.id, product.id, 'bottom')}
                                      disabled={isLast || isSavingProductOrder}
                                      className="p-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg disabled:opacity-20 cursor-pointer transition-all shadow-xs"
                                      title="Mover para o Final"
                                    >
                                      <ChevronsDown size={15} />
                                    </button>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-3xl font-serif font-bold">Histórico de Pedidos</h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="MM/DD/AAAA"
                    className="pl-10 p-2 rounded-xl border border-gray-300 text-sm w-32"
                    value={startDate}
                    onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.length > 8) val = val.slice(0, 8);
                      if (val.length > 4) val = val.slice(0, 2) + '/' + val.slice(2, 4) + '/' + val.slice(4);
                      else if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
                      setStartDate(val);
                    }}
                  />
                </div>
                <span className="text-gray-400">até</span>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="MM/DD/AAAA"
                    className="pl-10 p-2 rounded-xl border border-gray-300 text-sm w-32"
                    value={endDate}
                    onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.length > 8) val = val.slice(0, 8);
                      if (val.length > 4) val = val.slice(0, 2) + '/' + val.slice(2, 4) + '/' + val.slice(4);
                      else if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
                      setEndDate(val);
                    }}
                  />
                </div>
                <button 
                  onClick={() => {
                    setShowBatchSummary(false);
                    setStartDate('');
                    setEndDate('');
                    setSelectedHistoryCatalog('all');
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer",
                    (selectedHistoryCatalog === 'all' && !startDate && !endDate && !showBatchSummary) 
                      ? "bg-gray-800 text-white shadow-md" 
                      : "bg-white border border-gray-300 text-gray-600"
                  )}
                >
                  <History size={18} /> Todos os Pedidos
                </button>
                {settings?.catalog1Active !== false && (
                  <button 
                    onClick={() => {
                      setShowBatchSummary(false);
                      setSelectedHistoryCatalog('catalog1');
                    }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer",
                      (selectedHistoryCatalog === 'catalog1' && !showBatchSummary) 
                        ? "bg-gray-800 text-white shadow-md" 
                        : "bg-white border border-gray-300 text-gray-600"
                    )}
                  >
                    {settings?.catalog1Title || 'Cardápio 1'}
                  </button>
                )}
                {settings?.catalog2Active !== false && (
                  <button 
                    onClick={() => {
                      setShowBatchSummary(false);
                      setSelectedHistoryCatalog('catalog2');
                    }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer",
                      (selectedHistoryCatalog === 'catalog2' && !showBatchSummary) 
                        ? "bg-gray-800 text-white shadow-md" 
                        : "bg-white border border-gray-300 text-gray-600"
                    )}
                  >
                    {settings?.catalog2Title || 'Cardápio 2'}
                  </button>
                )}
                {settings?.catalog3Active !== false && (
                  <button 
                    onClick={() => {
                      setShowBatchSummary(false);
                      setSelectedHistoryCatalog('catalog3');
                    }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer",
                      (selectedHistoryCatalog === 'catalog3' && !showBatchSummary) 
                        ? "bg-gray-800 text-white shadow-md" 
                        : "bg-white border border-gray-300 text-gray-600"
                    )}
                  >
                    {settings?.catalog3Title || 'Cardápio 3'}
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (!startDate || !endDate) {
                      toast.error('Por favor, selecione um intervalo de datas primeiro.');
                      return;
                    }
                    setShowBatchSummary(!showBatchSummary);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all",
                    showBatchSummary ? "bg-blue-600 text-white shadow-md" : "bg-white border border-gray-300 text-gray-600"
                  )}
                >
                  <Layers size={18} /> Resumo de Produção
                </button>
                {showBatchSummary ? (
                  <button 
                    onClick={printProductionSummary}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-green-600 text-white hover:bg-green-700 transition-all shadow-md cursor-pointer"
                  >
                    <Printer size={18} /> Imprimir Resumo
                  </button>
                ) : (
                  <button 
                    onClick={printOrdersList}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-green-600 text-white hover:bg-green-700 transition-all shadow-md cursor-pointer"
                  >
                    <Printer size={18} /> Imprimir Lista
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => {
                    setIsCreatingManualOrder(true);
                    const today = new Date();
                    const yyyy = today.getFullYear();
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    const dd = String(today.getDate()).padStart(2, '0');
                    setManualOrderForm({
                      customerName: '',
                      phone: '',
                      email: '',
                      birthday: '',
                      fulfillmentType: 'pickup',
                      scheduledDate: `${yyyy}-${mm}-${dd}`,
                      scheduledTime: '12:00 PM',
                      address: '',
                      street: '',
                      number: '',
                      city: '',
                      zipCode: '',
                      observation: '',
                      items: [],
                      isB2B: false,
                      b2bCompanyName: '',
                      b2bManagerName: '',
                      applyTax: false,
                      taxRate: 8.25,
                      totalOverride: ''
                    });
                    setManualSelectedProductId('');
                    setManualSelectedSizeId('');
                    setManualItemQuantity(1);
                    setManualCustomTitle('');
                    setManualCustomPrice('');
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md cursor-pointer"
                  title="Inserir Pedido Manual"
                >
                  <Plus size={18} /> Inserir Pedido Manual
                </button>
              </div>
            </div>

            {/* INÍCIO DO CALENDÁRIO DE AGENDAMENTOS */}
            {(() => {
              // 1. Helpers de data e semana
              const getStartOfWeek = (d: Date): Date => {
                const date = new Date(d);
                const day = date.getDay();
                const diff = date.getDate() - day; // domingo é o início da semana
                const start = new Date(date.setDate(diff));
                start.setHours(0, 0, 0, 0);
                return start;
              };

              const startOfWeek = getStartOfWeek(currentCalendarDate);
              
              const weekDaysList = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(startOfWeek);
                d.setDate(startOfWeek.getDate() + i);
                return d;
              });

              // Dias do mês para visualização mensal
              const year = currentCalendarDate.getFullYear();
              const month = currentCalendarDate.getMonth();
              const firstDayOfMonth = new Date(year, month, 1);
              const startDayOfWeek = firstDayOfMonth.getDay();
              
              const startOfMonthGrid = new Date(firstDayOfMonth);
              startOfMonthGrid.setDate(firstDayOfMonth.getDate() - startDayOfWeek);
              
              const monthDaysList = Array.from({ length: 35 }, (_, i) => {
                const d = new Date(startOfMonthGrid);
                d.setDate(startOfMonthGrid.getDate() + i);
                return d;
              });

              const getHourFromTime = (timeStr?: string): number | null => {
                if (!timeStr) return null;
                const cleaned = timeStr.toUpperCase().trim();
                const match = cleaned.match(/^(\d+):(\d+)\s*(AM|PM)?$/);
                if (match) {
                  let hours = parseInt(match[1], 10);
                  const ampm = match[3];
                  if (ampm === 'PM' && hours < 12) {
                    hours += 12;
                  } else if (ampm === 'AM' && hours === 12) {
                    hours = 0;
                  }
                  return hours;
                }
                const parts = cleaned.split(':');
                if (parts.length >= 1) {
                  const hours = parseInt(parts[0], 10);
                  if (!isNaN(hours)) return hours;
                }
                return null;
              };

              const formatHourLabel = (h: number): string => {
                const ampm = h >= 12 ? 'PM' : 'AM';
                const displayH = h % 12 === 0 ? 12 : h % 12;
                return `${displayH.toString().padStart(2, '0')}:00 ${ampm}`;
              };

              const PT_WEEK_DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
              const PT_MONTHS = [
                'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
              ];

              const hourSlotsList = Array.from({ length: 15 }, (_, i) => i + 6); // 6:00 AM to 8:00 PM

              // Navegação
              const handlePrev = () => {
                const newD = new Date(currentCalendarDate);
                if (calendarViewMode === 'monthly') {
                  newD.setMonth(newD.getMonth() - 1);
                } else {
                  newD.setDate(newD.getDate() - 7);
                }
                setCurrentCalendarDate(newD);
              };

              const handleNext = () => {
                const newD = new Date(currentCalendarDate);
                if (calendarViewMode === 'monthly') {
                  newD.setMonth(newD.getMonth() + 1);
                } else {
                  newD.setDate(newD.getDate() + 7);
                }
                setCurrentCalendarDate(newD);
              };

              const handleToday = () => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                setCurrentCalendarDate(today);
              };

              const getCalendarTitle = (): string => {
                if (calendarViewMode === 'monthly') {
                  return `${PT_MONTHS[currentCalendarDate.getMonth()]} de ${currentCalendarDate.getFullYear()}`;
                } else {
                  const endOfWeek = new Date(startOfWeek);
                  endOfWeek.setDate(startOfWeek.getDate() + 6);
                  
                  const startMonth = PT_MONTHS[startOfWeek.getMonth()];
                  const endMonth = PT_MONTHS[endOfWeek.getMonth()];
                  
                  if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
                    return `Semana de ${startOfWeek.getDate()} a ${endOfWeek.getDate()} de ${startMonth} de ${startOfWeek.getFullYear()}`;
                  } else {
                    return `Semana de ${startOfWeek.getDate()} de ${startMonth} a ${endOfWeek.getDate()} de ${endMonth} de ${startOfWeek.getFullYear()}`;
                  }
                }
              };

              // Filtrar pedidos que possuem agendamento no período visível do calendário
              const visibleOrders = orders.filter(order => {
                const oDateStr = getOrderDateISO(order);
                if (!oDateStr) return false;
                
                // Se for mensal, filtra pelo mês selecionado
                if (calendarViewMode === 'monthly') {
                  const oDate = oDateStr.split('-');
                  if (oDate.length !== 3) return false;
                  const oMonth = parseInt(oDate[1], 10) - 1;
                  const oYear = parseInt(oDate[0], 10);
                  return oMonth === month && oYear === year;
                } else {
                  // Semanal: verifica se a data do pedido está entre startOfWeek e endOfWeek
                  const parts = oDateStr.split('-');
                  if (parts.length !== 3) return false;
                  const oD = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                  oD.setHours(0,0,0,0);
                  
                  const endOfWeek = new Date(startOfWeek);
                  endOfWeek.setDate(startOfWeek.getDate() + 6);
                  endOfWeek.setHours(23, 59, 59, 999);
                  
                  return oD >= startOfWeek && oD <= endOfWeek;
                }
              });

              return (
                <div id="admin-calendar-section" className="glass p-6 rounded-3xl space-y-6 shadow-md border border-white/20 animate-in fade-in slide-in-from-top-4">
                  {/* Cabeçalho do Calendário */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-xl font-serif font-black flex items-center gap-2 text-gray-950">
                        <Calendar size={22} className="text-amber-800" />
                        Cronograma de Entregas & Retiradas
                      </h3>
                      <p className="text-xs text-black/60 font-bold uppercase tracking-wider">Visualização dinâmica dos pedidos agendados</p>
                    </div>

                    {/* Toggles de Visualização */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="bg-black/5 p-1 rounded-xl flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCalendarViewMode('weekly-grid')}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            calendarViewMode === 'weekly-grid'
                              ? "bg-white text-black shadow-sm"
                              : "text-black/60 hover:text-black hover:bg-white/30"
                          )}
                        >
                          Grade Semanal
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalendarViewMode('weekly-agenda')}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            calendarViewMode === 'weekly-agenda'
                              ? "bg-white text-black shadow-sm"
                              : "text-black/60 hover:text-black hover:bg-white/30"
                          )}
                        >
                          Agenda Semanal
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalendarViewMode('monthly')}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            calendarViewMode === 'monthly'
                              ? "bg-white text-black shadow-sm"
                              : "text-black/60 hover:text-black hover:bg-white/30"
                          )}
                        >
                          Mensal
                        </button>
                      </div>

                      {/* Controles de Navegação */}
                      <div className="flex items-center gap-1 bg-white/50 border border-gray-200 p-1 rounded-xl shadow-sm">
                        <button
                          type="button"
                          onClick={handlePrev}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-black/70"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={handleToday}
                          className="px-2.5 py-1 rounded-lg hover:bg-gray-100 transition-colors text-xs font-bold text-black"
                        >
                          Hoje
                        </button>
                        <button
                          type="button"
                          onClick={handleNext}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-black/70"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Título do período atual */}
                  <div className="flex items-center justify-between border-b border-black/10 pb-3">
                    <span className="text-sm font-black text-black/80">{getCalendarTitle()}</span>
                    <span className="px-2.5 py-1 bg-black/5 rounded-full text-[10px] font-black text-black/60 uppercase tracking-widest">
                      {visibleOrders.length} {visibleOrders.length === 1 ? 'Pedido' : 'Pedidos'} no período
                    </span>
                  </div>

                  {/* RENDER VIEW: WEEKLY GRID */}
                  {calendarViewMode === 'weekly-grid' && (
                    <div className="border border-black/10 rounded-2xl overflow-hidden bg-white/40">
                      {/* Headers de Dias da Semana */}
                      <div className="grid grid-cols-8 border-b border-black/10 bg-white/60 select-none">
                        <div className="p-3 text-center text-xs font-black text-black/40 uppercase tracking-wider flex items-center justify-center border-r border-black/5 bg-gray-50/50">
                          <Clock size={14} className="text-black/30" />
                        </div>
                        {weekDaysList.map((day, idx) => {
                          const dateStr = formatDateToISO(day);
                          const isToday = formatDateToISO(new Date()) === dateStr;
                          return (
                            <div
                              key={idx}
                              className={cn(
                                "p-3 text-center border-r border-black/5 last:border-r-0 flex flex-col justify-center items-center gap-0.5",
                                isToday ? "bg-black/5" : ""
                              )}
                            >
                              <span className={cn("text-[10px] font-black tracking-wider uppercase", isToday ? "text-blue-600" : "text-black/50")}>
                                {PT_WEEK_DAYS[day.getDay()].slice(0, 3)}
                              </span>
                              <span className={cn(
                                "text-xs font-black px-1.5 py-0.5 rounded-md",
                                isToday ? "bg-blue-600 text-white shadow-sm" : "text-black/80"
                              )}>
                                {day.getDate().toString().padStart(2, '0')}/{ (day.getMonth() + 1).toString().padStart(2, '0') }
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Hourly Rows Container with Max Height */}
                      <div className="max-h-[380px] overflow-y-auto custom-scrollbar divide-y divide-black/5">
                        {hourSlotsList.map(hour => (
                          <div key={hour} className="grid grid-cols-8 min-h-[56px] hover:bg-black/[0.01] transition-colors">
                            {/* Time Slot Header */}
                            <div className="p-2 text-center text-[10px] font-black text-black/50 bg-gray-50/40 border-r border-black/5 flex items-center justify-center">
                              {formatHourLabel(hour)}
                            </div>

                            {/* Cells for each weekday */}
                            {weekDaysList.map((day, dayIdx) => {
                              const dateStr = formatDateToISO(day);
                              const cellOrders = visibleOrders.filter(order => {
                                const oDate = getOrderDateISO(order);
                                if (oDate !== dateStr) return false;
                                const oTime = getOrderTime(order);
                                const parsedHour = getHourFromTime(oTime);
                                return parsedHour === hour;
                              });

                              const isToday = formatDateToISO(new Date()) === dateStr;

                              return (
                                <div
                                  key={dayIdx}
                                  className={cn(
                                    "p-1.5 border-r border-black/5 last:border-r-0 relative flex flex-col gap-1.5 justify-center items-stretch min-h-[56px] group transition-colors",
                                    isToday ? "bg-black/[0.02]" : "",
                                    cellOrders.length === 0 ? "hover:bg-black/[0.02]" : ""
                                  )}
                                >
                                  {cellOrders.map(order => {
                                    const isDelivery = order.fulfillmentType === 'delivery';
                                    const isEntregue = order.deliveryStatus === 'entregue';
                                    const isValidado = order.productionStatus === 'validado';
                                    const paymentStatus = order.paymentStatus || 'nao_pago';

                                    const cardColorClass = isEntregue
                                      ? "bg-emerald-50/90 border-2 border-emerald-500 hover:bg-emerald-100/90 text-emerald-950 shadow-sm"
                                      : isValidado
                                      ? "bg-indigo-50/90 border-2 border-indigo-400 hover:bg-indigo-100/90 text-indigo-950 shadow-sm"
                                      : paymentStatus === '50_sinal'
                                      ? "bg-amber-50/90 border-2 border-amber-400 hover:bg-amber-100/90 text-amber-950 shadow-sm"
                                      : paymentStatus === 'pago_100'
                                      ? "bg-teal-50/90 border-2 border-teal-400 hover:bg-teal-100/90 text-teal-950 shadow-sm"
                                      : isDelivery 
                                      ? "bg-amber-50/80 border-amber-200 hover:bg-amber-100 text-amber-900" 
                                      : "bg-blue-50/80 border-blue-200 hover:bg-blue-100 text-blue-900";

                                    return (
                                      <button
                                        key={order.id}
                                        type="button"
                                        onClick={() => setSelectedCalendarOrder(order)}
                                        className={cn(
                                          "p-1.5 rounded-xl border text-left text-[11px] leading-tight font-bold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer select-none flex flex-col gap-0.5",
                                          cardColorClass
                                        )}
                                      >
                                        <div className="flex items-center justify-between gap-1 mb-0.5">
                                          <span className="truncate max-w-[50px] sm:max-w-[80px] font-black uppercase text-[9px] tracking-wider">
                                            {order.customerName.split(' ')[0]}
                                          </span>
                                          <span className="text-[10px] shrink-0 font-black">
                                            ${order.total.toFixed(2)}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-1 text-[9px] font-bold">
                                          {isEntregue ? (
                                            <span className="px-1 py-0.2 rounded bg-emerald-600 text-white font-black text-[8px] uppercase">
                                              ENTREGUE
                                            </span>
                                          ) : isValidado ? (
                                            <span className="px-1 py-0.2 rounded bg-indigo-600 text-white font-black text-[8px] uppercase">
                                              PRODUÇÃO
                                            </span>
                                          ) : (
                                            <span className="px-1 py-0.2 rounded bg-black/5 text-black font-black tracking-wider text-[8px] uppercase">
                                              {isDelivery ? 'DELIVERY' : 'PICKUP'}
                                            </span>
                                          )}
                                          <span className="text-[8px] font-bold">
                                            {paymentStatus === '50_sinal' ? '🟡 50%' : paymentStatus === 'pago_100' ? '🟢 100%' : '⚪'}
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* RENDER VIEW: WEEKLY AGENDA */}
                  {calendarViewMode === 'weekly-agenda' && (
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                      {weekDaysList.map((day, idx) => {
                        const dateStr = formatDateToISO(day);
                        const isToday = formatDateToISO(new Date()) === dateStr;
                        const dayOrders = visibleOrders.filter(order => getOrderDateISO(order) === dateStr)
                          .sort((a, b) => {
                            const ha = getHourFromTime(getOrderTime(a)) || 0;
                            const hb = getHourFromTime(getOrderTime(b)) || 0;
                            return ha - hb;
                          });

                        return (
                          <div
                            key={idx}
                            className={cn(
                              "p-3 rounded-2xl border flex flex-col min-h-[180px] transition-all bg-white/50 backdrop-blur-sm",
                              isToday 
                                ? "border-blue-300 shadow-md ring-2 ring-blue-500/10" 
                                : "border-black/5 shadow-sm hover:shadow-md"
                            )}
                          >
                            <div className="border-b border-black/5 pb-2 mb-2 flex items-center justify-between select-none">
                              <div className="flex flex-col">
                                <span className={cn("text-[10px] font-black uppercase tracking-wider", isToday ? "text-blue-600" : "text-black/50")}>
                                  {PT_WEEK_DAYS[day.getDay()]}
                                </span>
                                <span className="text-xs font-black text-black/80">
                                  {day.getDate().toString().padStart(2, '0')}/{ (day.getMonth() + 1).toString().padStart(2, '0') }
                                </span>
                              </div>
                              {isToday && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-black rounded-full uppercase tracking-widest">
                                  Hoje
                                </span>
                              )}
                            </div>

                            <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[220px] custom-scrollbar pr-0.5">
                              {dayOrders.length > 0 ? (
                                dayOrders.map(order => {
                                  const isDelivery = order.fulfillmentType === 'delivery';
                                  const isEntregue = order.deliveryStatus === 'entregue';
                                  const isValidado = order.productionStatus === 'validado';
                                  const paymentStatus = order.paymentStatus || 'nao_pago';

                                  const cardColorClass = isEntregue
                                    ? "bg-emerald-50/90 border-2 border-emerald-500 hover:bg-emerald-100/90 text-emerald-950 shadow-sm"
                                    : isValidado
                                    ? "bg-indigo-50/90 border-2 border-indigo-400 hover:bg-indigo-100/90 text-indigo-950 shadow-sm"
                                    : paymentStatus === '50_sinal'
                                    ? "bg-amber-50/90 border-2 border-amber-400 hover:bg-amber-100/90 text-amber-950 shadow-sm"
                                    : paymentStatus === 'pago_100'
                                    ? "bg-teal-50/90 border-2 border-teal-400 hover:bg-teal-100/90 text-teal-950 shadow-sm"
                                    : isDelivery
                                    ? "bg-amber-50/70 border-2 border-amber-200 hover:bg-amber-100/80 text-amber-950 shadow-xs"
                                    : "bg-blue-50/70 border-2 border-blue-200 hover:bg-blue-100/80 text-blue-950 shadow-xs";

                                  const dividerClass = isEntregue
                                    ? "border-emerald-200"
                                    : isValidado
                                    ? "border-indigo-200"
                                    : paymentStatus === '50_sinal'
                                    ? "border-amber-200"
                                    : paymentStatus === 'pago_100'
                                    ? "border-teal-200"
                                    : "border-gray-200";

                                  const itemsSummary = order.items && order.items.length > 0
                                    ? order.items.map(it => `${it.quantity}x ${it.title}`).join(', ')
                                    : 'Nenhum item especificado';

                                  return (
                                    <button
                                      key={order.id}
                                      type="button"
                                      onClick={() => setSelectedCalendarOrder(order)}
                                      className={cn(
                                        "p-2.5 rounded-xl border text-left text-xs leading-snug font-bold transition-all hover:-translate-y-0.5 cursor-pointer flex flex-col gap-1 w-full",
                                        cardColorClass
                                      )}
                                    >
                                      {/* Top Row: Status / Fulfillment Pill + Scheduled Time */}
                                      <div className="flex items-center justify-between gap-1">
                                        {isEntregue ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white font-black text-[9px] uppercase tracking-wider shadow-xs">
                                            <CheckCircle2 size={10} /> ENTREGUE
                                          </span>
                                        ) : isValidado ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-600 text-white font-black text-[9px] uppercase tracking-wider shadow-xs">
                                            <Rocket size={10} /> PRODUÇÃO
                                          </span>
                                        ) : (
                                          <span className={cn(
                                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-black text-[9px] uppercase tracking-wider",
                                            isDelivery ? "bg-amber-200/90 text-amber-900" : "bg-blue-100 text-blue-900"
                                          )}>
                                            {isDelivery ? 'DELIVERY' : 'PICKUP'}
                                          </span>
                                        )}

                                        <span className="text-[10px] font-black flex items-center gap-1 text-gray-700 shrink-0">
                                          <Clock size={10} className="text-gray-400" />
                                          {order.scheduledTime || 'N/A'}
                                        </span>
                                      </div>

                                      {/* Customer Name */}
                                      <h5 className="font-black text-xs text-gray-900 truncate mt-0.5" title={order.customerName}>
                                        {order.customerName}
                                      </h5>

                                      {/* Items Summary Preview */}
                                      <p className="text-[10px] text-gray-500 font-medium line-clamp-2 leading-tight">
                                        {itemsSummary}
                                      </p>

                                      {/* Divider Line */}
                                      <div className={cn("border-t my-1", dividerClass)} />

                                      {/* Bottom Row: Payment Pill & Total */}
                                      <div className="flex items-center justify-between gap-1 text-[10px]">
                                        {paymentStatus === '50_sinal' ? (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 font-black text-[9px]">
                                            🟡 50%
                                          </span>
                                        ) : paymentStatus === 'pago_100' ? (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-900 font-black text-[9px]">
                                            🟢 100%
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 border border-gray-300 text-gray-600 font-black text-[9px]">
                                            ⚪ Não Pago
                                          </span>
                                        )}

                                        <span className="font-black text-xs text-gray-900 shrink-0">
                                          ${order.total.toFixed(2)}
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="flex-1 flex items-center justify-center py-6 text-center select-none">
                                  <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest">Nenhum Pedido</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* RENDER VIEW: MONTHLY GRID */}
                  {calendarViewMode === 'monthly' && (
                    <div className="border border-black/10 rounded-2xl overflow-hidden bg-white/40">
                      {/* Headers de Dias */}
                      <div className="grid grid-cols-7 border-b border-black/10 bg-white/60 select-none">
                        {PT_WEEK_DAYS.map((dayName, idx) => (
                          <div key={idx} className="p-3 text-center text-xs font-black text-black/50 uppercase tracking-wider border-r border-black/5 last:border-r-0 bg-gray-50/20">
                            {dayName.slice(0, 3)}
                          </div>
                        ))}
                      </div>

                      {/* Grid de Dias */}
                      <div className="grid grid-cols-7 divide-x divide-y divide-black/5 border-t border-black/5 bg-white/20">
                        {monthDaysList.map((day, idx) => {
                          const dateStr = formatDateToISO(day);
                          const isCurrentMonth = day.getMonth() === month;
                          const isToday = formatDateToISO(new Date()) === dateStr;
                          
                          const dayOrders = visibleOrders.filter(order => getOrderDateISO(order) === dateStr)
                            .sort((a, b) => {
                              const ha = getHourFromTime(getOrderTime(a)) || 0;
                              const hb = getHourFromTime(getOrderTime(b)) || 0;
                              return ha - hb;
                            });

                          return (
                            <div
                              key={idx}
                              className={cn(
                                "p-2 min-h-[96px] flex flex-col gap-1 border-black/5 transition-colors",
                                isCurrentMonth ? "bg-transparent" : "bg-black/[0.03] opacity-40",
                                isToday ? "bg-blue-50/30" : ""
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className={cn(
                                  "text-xs font-black rounded-md px-1.5 py-0.5",
                                  isToday 
                                    ? "bg-blue-600 text-white shadow-sm" 
                                    : isCurrentMonth ? "text-black/80" : "text-black/40"
                                )}>
                                  {day.getDate().toString().padStart(2, '0')}
                                </span>
                                {dayOrders.length > 0 && (
                                  <span className="text-[9px] font-black bg-black/5 px-1.5 py-0.5 rounded-full text-black/60 uppercase">
                                    {dayOrders.length} {dayOrders.length === 1 ? 'ped' : 'peds'}
                                  </span>
                                )}
                              </div>

                              <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[64px] custom-scrollbar">
                                {dayOrders.slice(0, 3).map(order => {
                                  const isEntregue = order.deliveryStatus === 'entregue';
                                  const isValidado = order.productionStatus === 'validado';
                                  const paymentStatus = order.paymentStatus || 'nao_pago';

                                  const badgeColor = isEntregue
                                    ? "bg-emerald-100 border-emerald-400 text-emerald-900 hover:bg-emerald-200"
                                    : isValidado
                                    ? "bg-indigo-100 border-indigo-400 text-indigo-900 hover:bg-indigo-200"
                                    : paymentStatus === '50_sinal'
                                    ? "bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200"
                                    : paymentStatus === 'pago_100'
                                    ? "bg-teal-100 border-teal-300 text-teal-900 hover:bg-teal-200"
                                    : order.fulfillmentType === 'delivery'
                                    ? "bg-amber-50/90 border-amber-200 text-amber-800 hover:bg-amber-100"
                                    : "bg-blue-50/90 border-blue-200 text-blue-800 hover:bg-blue-100";

                                  return (
                                    <button
                                      key={order.id}
                                      type="button"
                                      onClick={() => setSelectedCalendarOrder(order)}
                                      className={cn(
                                        "p-1 rounded text-left text-[9px] font-black leading-none truncate border cursor-pointer select-none flex items-center justify-between gap-1",
                                        badgeColor
                                      )}
                                    >
                                      <span className="truncate">
                                        <span className="font-extrabold">{order.scheduledTime?.split(' ')[0] || '10h'}</span> - {order.customerName.split(' ')[0]}
                                      </span>
                                      {isEntregue ? (
                                        <span className="text-[7px] font-black bg-emerald-600 text-white px-1 py-0.2 rounded">✓</span>
                                      ) : paymentStatus === '50_sinal' ? (
                                        <span className="text-[7px]">🟡</span>
                                      ) : paymentStatus === 'pago_100' ? (
                                        <span className="text-[7px]">🟢</span>
                                      ) : null}
                                    </button>
                                  );
                                })}
                                {dayOrders.length > 3 && (
                                  <div className="text-[8px] font-black text-center text-black/40 uppercase tracking-widest py-0.5 bg-black/5 rounded">
                                    + {dayOrders.length - 3} mais
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* QUICK VIEW POPUP PARA DETALHES DO PEDIDO NO CALENDÁRIO */}
            <AnimatePresence>
              {selectedCalendarOrder && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col text-gray-900"
                  >
                    {/* Header */}
                    <div className="p-5 sm:p-6 border-b border-gray-100 flex items-start justify-between bg-gray-50/70">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                            DETALHES DO PEDIDO
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-gray-200 text-gray-800 font-mono text-xs font-black">
                            #{selectedCalendarOrder.id.slice(-6).toUpperCase()}
                          </span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-serif font-black text-gray-900 leading-tight">
                          {selectedCalendarOrder.customerName}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-0.5">
                          <Calendar size={13} className="text-gray-400" />
                          <span>
                            Criado em: {selectedCalendarOrder.createdAt?.toDate ? selectedCalendarOrder.createdAt.toDate().toLocaleString('pt-BR') : 'N/A'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCalendarOrder(null)}
                        className="p-2.5 rounded-2xl hover:bg-gray-200/80 transition-colors text-gray-400 hover:text-gray-800 cursor-pointer"
                        title="Fechar popup"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-sm custom-scrollbar">
                      {/* 1. GERENCIAMENTO DE STATUS EM TEMPO REAL */}
                      <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/60 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-800">
                            <ShieldCheck size={16} className="text-gray-700" />
                            <span>GERENCIAMENTO DE STATUS EM TEMPO REAL</span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-semibold hidden sm:inline">
                            Clique nos botões para alterar
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Coluna 1: STATUS PAGAMENTO */}
                          <div className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-xs space-y-2.5 flex flex-col justify-between">
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                                STATUS PAGAMENTO
                              </span>
                              <div>
                                {selectedCalendarOrder.paymentStatus === '50_sinal' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 font-black text-xs shadow-xs">
                                    🟡 50% SINAL
                                  </span>
                                ) : selectedCalendarOrder.paymentStatus === 'pago_100' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 font-black text-xs shadow-xs">
                                    🟢 PAGO 100%
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-300 text-gray-700 font-black text-xs shadow-xs">
                                    ⚪ NÃO PAGO
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-1 pt-1 border-t border-gray-100">
                              <button
                                type="button"
                                onClick={() => handleUpdateOrderStatus(selectedCalendarOrder.id, { paymentStatus: 'nao_pago' })}
                                className={cn(
                                  "py-1.5 px-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer text-center",
                                  (!selectedCalendarOrder.paymentStatus || selectedCalendarOrder.paymentStatus === 'nao_pago')
                                    ? "bg-gray-800 text-white border-gray-800 shadow-xs"
                                    : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200"
                                )}
                              >
                                Não Pago
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateOrderStatus(selectedCalendarOrder.id, { paymentStatus: '50_sinal' })}
                                className={cn(
                                  "py-1.5 px-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer text-center",
                                  selectedCalendarOrder.paymentStatus === '50_sinal'
                                    ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                    : "bg-gray-50 hover:bg-amber-50 text-gray-600 border-gray-200"
                                )}
                              >
                                50% Sinal
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateOrderStatus(selectedCalendarOrder.id, { paymentStatus: 'pago_100' })}
                                className={cn(
                                  "py-1.5 px-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer text-center",
                                  selectedCalendarOrder.paymentStatus === 'pago_100'
                                    ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                                    : "bg-gray-50 hover:bg-emerald-50 text-gray-600 border-gray-200"
                                )}
                              >
                                Pago 100%
                              </button>
                            </div>
                          </div>

                          {/* Coluna 2: VALIDAÇÃO PRODUÇÃO */}
                          <div className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-xs space-y-2.5 flex flex-col justify-between">
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                                VALIDAÇÃO PRODUÇÃO
                              </span>
                              <div>
                                {selectedCalendarOrder.productionStatus === 'validado' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100 border border-blue-300 text-blue-900 font-black text-xs shadow-xs">
                                    🚀 VALIDADO / PRODUÇÃO
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-300 text-gray-700 font-black text-xs shadow-xs">
                                    ⏱️ ⏳ PENDENTE
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="pt-1 border-t border-gray-100">
                              {selectedCalendarOrder.productionStatus === 'validado' ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(selectedCalendarOrder.id, { productionStatus: 'pendente' })}
                                  className="w-full py-2 px-2 rounded-xl text-xs font-black border-2 border-blue-500 bg-blue-50 text-blue-800 hover:bg-blue-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                                >
                                  <RotateCcw size={13} /> RETORNAR PENDENTE
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(selectedCalendarOrder.id, { productionStatus: 'validado' })}
                                  className="w-full py-2 px-2 rounded-xl text-xs font-black border border-gray-300 bg-white hover:bg-blue-50 hover:border-blue-500 text-gray-800 hover:text-blue-900 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                                >
                                  <Rocket size={13} className="text-blue-600" /> VALIDAR PRODUÇÃO
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Coluna 3: STATUS DA ENTREGA */}
                          <div className={cn(
                            "p-3.5 rounded-xl border shadow-xs space-y-2.5 flex flex-col justify-between transition-all",
                            selectedCalendarOrder.deliveryStatus === 'entregue'
                              ? "bg-emerald-50/80 border-2 border-emerald-500"
                              : "bg-white border-gray-200"
                          )}>
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                                STATUS DA ENTREGA
                              </span>
                              <div>
                                {selectedCalendarOrder.deliveryStatus === 'entregue' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs shadow-xs">
                                    <CheckCircle2 size={13} /> ENTREGUE
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 font-black text-xs shadow-xs">
                                    ⏳ A ENTREGAR
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="pt-1 border-t border-gray-100">
                              {selectedCalendarOrder.deliveryStatus === 'entregue' ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(selectedCalendarOrder.id, { deliveryStatus: 'a_entregar' })}
                                  className="w-full py-2 px-2 rounded-xl text-xs font-black border-2 border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                                >
                                  <RotateCcw size={13} /> ALTERAR A ENTREGAR
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(selectedCalendarOrder.id, { deliveryStatus: 'entregue' })}
                                  className="w-full py-2 px-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                                >
                                  <CheckCircle2 size={13} /> MARCAR ENTREGUE
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 2. OPÇÃO DE ENTREGA & HORÁRIO E DATA AGENDADA */}
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-center gap-3.5 shadow-xs">
                            <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl shrink-0">
                              {selectedCalendarOrder.fulfillmentType === 'delivery' ? <Truck size={22} /> : <Store size={22} />}
                            </div>
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800/80 block">
                                OPÇÃO DE ENTREGA
                              </span>
                              <h6 className="font-black text-sm text-amber-950 truncate">
                                {selectedCalendarOrder.fulfillmentType === 'delivery' ? 'Delivery (Entrega no Endereço)' : 'Pickup (Retirada no Local)'}
                              </h6>
                            </div>
                          </div>

                          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-center justify-between gap-3.5 shadow-xs">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className="p-3 bg-blue-100 text-blue-800 rounded-2xl shrink-0">
                                <Clock size={22} />
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-800/80 block">
                                  HORÁRIO E DATA AGENDADA
                                </span>
                                <h6 className="font-black text-sm text-blue-950 truncate">
                                  {selectedCalendarOrder.scheduledTime || 'N/A'} • {selectedCalendarOrder.scheduledDate || selectedCalendarOrder.pickupDate?.split(' at ')[0] || 'N/A'}
                                </h6>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditingPopupDateTime(!isEditingPopupDateTime);
                                setPopupEditDate(selectedCalendarOrder.scheduledDate || selectedCalendarOrder.pickupDate?.split(' at ')[0] || '');
                                setPopupEditTime(selectedCalendarOrder.scheduledTime || (selectedCalendarOrder.pickupDate && selectedCalendarOrder.pickupDate.includes(' at ') ? selectedCalendarOrder.pickupDate.split(' at ')[1] : '10:00 AM'));
                                setPopupEditFulfillment(selectedCalendarOrder.fulfillmentType || 'pickup');
                              }}
                              className="px-2.5 py-1.5 rounded-xl border border-blue-300 bg-white hover:bg-blue-50 text-blue-700 text-xs font-black shadow-xs shrink-0 cursor-pointer transition-all flex items-center gap-1"
                              title="Alterar data ou horário de entrega"
                            >
                              <Edit2 size={13} /> {isEditingPopupDateTime ? 'Cancelar' : 'Alterar'}
                            </button>
                          </div>
                        </div>

                        {/* Formulário Inline para Alterar Data / Horário de Entrega (Imagem 9) */}
                        {isEditingPopupDateTime && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-4 rounded-2xl bg-blue-50/90 border-2 border-blue-400 space-y-3 shadow-md"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
                                <Calendar size={15} className="text-blue-600" />
                                Alterar Data e Horário de Entrega/Retirada
                              </span>
                              <span className="text-[10px] font-bold text-blue-700">Salve para atualizar no calendário</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {/* Modalidade */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-gray-700">Modalidade</label>
                                <div className="grid grid-cols-2 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setPopupEditFulfillment('pickup')}
                                    className={cn(
                                      "py-2 px-1 text-xs font-black rounded-xl border text-center transition-all cursor-pointer",
                                      popupEditFulfillment === 'pickup'
                                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                    )}
                                  >
                                    Pickup
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPopupEditFulfillment('delivery')}
                                    className={cn(
                                      "py-2 px-1 text-xs font-black rounded-xl border text-center transition-all cursor-pointer",
                                      popupEditFulfillment === 'delivery'
                                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                    )}
                                  >
                                    Delivery
                                  </button>
                                </div>
                              </div>

                              {/* Nova Data */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-gray-700">Data (AAAA-MM-DD)</label>
                                <input
                                  type="date"
                                  value={popupEditDate}
                                  onChange={e => setPopupEditDate(e.target.value)}
                                  className="w-full p-2 rounded-xl border border-gray-300 bg-white text-gray-900 text-xs font-bold"
                                />
                              </div>

                              {/* Novo Horário */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-gray-700">Horário</label>
                                <input
                                  type="text"
                                  placeholder="ex: 10:00 AM ou 01:00 PM"
                                  value={popupEditTime}
                                  onChange={e => setPopupEditTime(e.target.value)}
                                  className="w-full p-2 rounded-xl border border-gray-300 bg-white text-gray-900 text-xs font-bold"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-blue-200">
                              <button
                                type="button"
                                onClick={() => setIsEditingPopupDateTime(false)}
                                className="px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-100 cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={isSavingPopupDateTime}
                                onClick={() => handleSavePopupDeliveryDateTime(selectedCalendarOrder.id)}
                                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {isSavingPopupDateTime ? 'Salvando...' : 'Salvar Nova Data / Horário'}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {/* 3. DADOS DO CLIENTE / CONTATO */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-gray-700">
                          <Users size={15} className="text-gray-600" />
                          <span>DADOS DO CLIENTE / CONTATO</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">NOME DO CLIENTE</span>
                            <span className="text-sm font-black text-gray-900 block truncate">{selectedCalendarOrder.customerName}</span>
                          </div>

                          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">TELEFONE / WHATSAPP</span>
                            <a 
                              href={`https://wa.me/${selectedCalendarOrder.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-black text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1.5"
                            >
                              <MessageCircle size={15} /> {selectedCalendarOrder.phone}
                            </a>
                          </div>

                          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">E-MAIL</span>
                            <span className="text-sm font-bold text-blue-600 block truncate">{selectedCalendarOrder.email || '-'}</span>
                          </div>

                          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block flex items-center gap-1">
                              <Cake size={11} className="text-pink-500" /> ANIVERSÁRIO
                            </span>
                            <span className="text-sm font-black text-gray-900 block">{selectedCalendarOrder.birthday || '-'}</span>
                          </div>

                          {selectedCalendarOrder.fulfillmentType === 'delivery' && (
                            <div className="sm:col-span-2 p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                <MapPin size={12} className="text-red-500" /> ENDEREÇO DE ENTREGA
                              </span>
                              <div className="text-xs font-bold text-gray-800 leading-relaxed">
                                <p className="font-black text-sm">{selectedCalendarOrder.street || selectedCalendarOrder.address}{selectedCalendarOrder.number ? `, nº ${selectedCalendarOrder.number}` : ''}</p>
                                {(selectedCalendarOrder.city || selectedCalendarOrder.zipCode) && (
                                  <p className="text-gray-500 text-xs">{selectedCalendarOrder.city ? `${selectedCalendarOrder.city} ` : ''}{selectedCalendarOrder.zipCode ? `- CEP: ${selectedCalendarOrder.zipCode}` : ''}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 4. OBSERVAÇÃO */}
                      {selectedCalendarOrder.observation && (
                        <div className="space-y-1.5">
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-1">Observações do Cliente</h5>
                          <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl text-xs font-bold text-red-900">
                            {selectedCalendarOrder.observation}
                          </div>
                        </div>
                      )}

                      {/* 5. ITENS DO PEDIDO */}
                      <div className="space-y-2">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-1">Itens do Pedido</h5>
                        <div className="divide-y divide-gray-100">
                          {selectedCalendarOrder.items.map((item, itemIdx) => (
                            <div key={itemIdx} className="py-2.5 flex justify-between items-start text-xs font-bold">
                              <div className="space-y-0.5 flex-1 pr-2">
                                <span>{item.quantity}x {item.title}</span>
                                {item.selectedSize && (
                                  <div className="text-[10px] text-gray-500">Tamanho: {item.selectedSize.name}</div>
                                )}
                                {item.cakeOptions && (
                                  <div className="text-[10px] text-gray-600 bg-gray-50 p-2.5 rounded-xl mt-1 space-y-1 border border-gray-100">
                                    {item.cakeOptions.styleNumber && <div className="font-bold text-gray-800">Modelo: {item.cakeOptions.styleNumber}</div>}
                                    {item.cakeOptions.size && <div>Tamanho: {item.cakeOptions.size}</div>}
                                    {item.cakeOptions.dough && <div>Massa: {item.cakeOptions.dough}</div>}
                                    {item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0 && (
                                      <div>Recheios: {item.cakeOptions.fillings.join(', ')}</div>
                                    )}
                                    {item.cakeOptions.topping && <div>Cobertura: {item.cakeOptions.topping}</div>}
                                    {item.cakeOptions.customReferenceDescription && (
                                      <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-950">
                                        <span className="font-bold block text-[10px] uppercase text-amber-800">Referência Desejada pelo Cliente:</span>
                                        <p className="text-xs italic mt-0.5">{item.cakeOptions.customReferenceDescription}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <span className="shrink-0 text-gray-900 font-black">${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 6. TOTAIS */}
                      <div className="border-t border-gray-100 pt-4 space-y-1.5 text-xs font-bold text-gray-700">
                        {selectedCalendarOrder.subtotal !== undefined && (
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>${selectedCalendarOrder.subtotal.toFixed(2)}</span>
                          </div>
                        )}
                        {selectedCalendarOrder.taxAmount !== undefined && (
                          <div className="flex justify-between">
                            <span>Impostos (8.25%):</span>
                            <span>${selectedCalendarOrder.taxAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-lg font-black text-gray-950 pt-3 border-t-2 border-gray-200">
                          <span className="text-gray-900 uppercase tracking-wide text-sm font-black">Total Geral:</span>
                          <span className="text-2xl font-black text-gray-950 tracking-tight">${selectedCalendarOrder.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-5 sm:p-6 border-t border-gray-100 bg-gray-50/70 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const order = selectedCalendarOrder;
                          setSelectedCalendarOrder(null);
                          setTimeout(() => {
                            const el = document.getElementById(`order-${order.id}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              el.classList.add('ring-4', 'ring-blue-500', 'transition-all');
                              setTimeout(() => {
                                el.classList.remove('ring-4', 'ring-blue-500');
                              }, 3000);
                            } else {
                              toast.error('Pedido não encontrado na lista do histórico. Verifique se há filtros ativos bloqueando este pedido.');
                            }
                          }, 150);
                        }}
                        className="flex-1 py-3 px-4 rounded-xl text-xs font-black bg-white border border-gray-300 hover:bg-gray-100 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-gray-800"
                      >
                        <Search size={14} /> Ver na Lista Geral
                      </button>
                      <button
                        type="button"
                        onClick={() => printOrder(selectedCalendarOrder)}
                        className="flex-1 py-3 px-4 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Printer size={14} /> Imprimir Comanda
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCalendarOrder(null)}
                        className="py-3 px-6 rounded-xl text-xs font-black bg-[#134e2b] text-white hover:bg-[#0c331c] transition-colors cursor-pointer shadow-xs"
                      >
                        Fechar
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
            {/* FIM DO CALENDÁRIO DE AGENDAMENTOS */}

            <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-gray-200/80 shadow-sm">
              <input 
                type="text" 
                placeholder="Buscar por nome do cliente..."
                className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900"
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
              />
            </div>

            {showBatchSummary ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl border border-gray-200/80 shadow-md space-y-4">
                  <h3 className="text-xl font-serif font-bold flex items-center gap-2 text-gray-900">
                    <Package size={20} className="text-blue-600" />
                    Total de Itens
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(batchSummary.items).length > 0 ? (
                      Object.entries(batchSummary.items).map(([title, qty]) => (
                        <div key={title} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-200">
                          <span className="font-bold text-gray-800">{title}</span>
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-bold">{qty}x</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-gray-400 py-4">Nenhum item no período</p>
                    )}
                  </div>
                </div>

                <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl border border-gray-200/80 shadow-md space-y-4">
                  <h3 className="text-xl font-serif font-bold flex items-center gap-2 text-gray-900">
                    <Plus size={20} className="text-green-600" />
                    Total de Acompanhamentos
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(batchSummary.sides).length > 0 ? (
                      Object.entries(batchSummary.sides).map(([name, qty]) => (
                        <div key={name} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-200">
                          <span className="font-bold text-gray-800">{name}</span>
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-bold">{qty}x</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-gray-400 py-4">Nenhum acompanhamento no período</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map(order => {
                  const isEntregue = order.deliveryStatus === 'entregue';
                  const isValidado = order.productionStatus === 'validado';
                  const paymentStatus = order.paymentStatus || 'nao_pago';

                  const listCardBorder = isEntregue
                    ? "border-2 border-emerald-500 shadow-sm"
                    : isValidado
                    ? "border-2 border-indigo-500 shadow-sm"
                    : paymentStatus === '50_sinal'
                    ? "border-2 border-amber-400 shadow-sm"
                    : paymentStatus === 'pago_100'
                    ? "border-2 border-teal-500 shadow-sm"
                    : "border border-gray-200 shadow-sm";

                  return (
                    <motion.div 
                      layout
                      key={order.id} 
                      id={`order-${order.id}`}
                      className={cn(
                        "bg-white p-6 rounded-2xl space-y-4 shadow-md transition-all text-gray-900",
                        listCardBorder
                      )}
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <h3 className="text-xl font-serif font-bold text-gray-900">
                              {order.isB2B || order.isPJ 
                                ? (order.b2bCompanyName || order.customerName)
                                : order.customerName
                              }
                            </h3>
                            {/* Badges de Status em Tempo Real */}
                            {paymentStatus === '50_sinal' && (
                              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black rounded-lg flex items-center gap-1 shadow-xs">
                                🟡 50% Sinal
                              </span>
                            )}
                            {paymentStatus === 'pago_100' && (
                              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black rounded-lg flex items-center gap-1 shadow-xs">
                                🟢 Pago 100%
                              </span>
                            )}
                            {paymentStatus === 'nao_pago' && (
                              <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 border border-gray-300 text-xs font-black rounded-lg flex items-center gap-1 shadow-xs">
                                ⚪ Não Pago
                              </span>
                            )}
                            {isValidado && (
                              <span className="px-2.5 py-0.5 bg-indigo-600 text-white text-xs font-black rounded-lg flex items-center gap-1 shadow-xs">
                                <Rocket size={12} /> Produção
                              </span>
                            )}
                            {isEntregue && (
                              <span className="px-2.5 py-0.5 bg-emerald-600 text-white text-xs font-black rounded-lg flex items-center gap-1 shadow-xs">
                                <CheckCircle2 size={12} /> Entregue
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedCalendarOrder(order)}
                              className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                              title="Gerenciar status do pedido no pop-up"
                            >
                              Status ⚙️
                            </button>
                            {(order.isB2B || order.isPJ) && (
                              <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-black rounded-full flex items-center gap-1 border border-amber-200 uppercase tracking-widest animate-pulse">
                                ★ Corporate PJ
                              </span>
                            )}
                            {isBirthdayThisWeek(order.birthday, order.orderLanguage) && (
                              <span className="px-3 py-1 bg-pink-100 text-pink-600 text-xs font-bold rounded-full flex items-center gap-1">
                                <Cake size={12} /> Aniversariante! ({order.birthday})
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            <a 
                              href={`https://wa.me/${order.phone.replace(/\D/g, '')}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:text-green-600 transition-colors font-bold text-gray-900"
                            >
                              <MessageCircle size={14} className="text-green-600" /> {order.phone}
                            </a>
                            <span className="flex items-center gap-1"><Calendar size={14} /> Criado em: {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('en-US') : 'N/A'}</span>
                            {(order.pickupDate || order.scheduledDate) && (
                              <button 
                                type="button"
                                onClick={() => jumpToOrderDate(order)}
                                className="flex items-center gap-1.5 font-black px-3 py-1 rounded-xl shadow-xs text-xs text-white bg-gray-900 hover:bg-black transition-all cursor-pointer"
                                title="Clique para localizar este pedido no calendário acima"
                              >
                                <Calendar size={12} />
                                {order.fulfillmentType === 'delivery' ? 'DELIVERY' : 'PICKUP'}: {order.pickupDate || `${order.scheduledDate}${order.scheduledTime ? ` at ${order.scheduledTime}` : ''}`} ↗
                              </button>
                            )}
                          </div>
                        </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <button 
                          onClick={() => printOrder(order)}
                          className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 shadow-sm cursor-pointer"
                          title="Imprimir Comanda"
                        >
                          <Printer size={20} />
                        </button>
                        <button 
                          onClick={() => {
                            setIsEditingOrder(order);
                            setEditOrderForm(order);
                          }}
                          className="p-3 bg-white border border-gray-200 rounded-xl text-blue-600 hover:bg-blue-50 shadow-sm cursor-pointer"
                          title="Editar Pedido"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button 
                          onClick={() => deleteOrder(order.id)}
                          className="p-3 bg-white border border-gray-200 rounded-xl text-red-600 hover:bg-red-50 shadow-sm cursor-pointer"
                          title="Excluir Pedido"
                        >
                          <Trash2 size={20} />
                        </button>
                        <button 
                          onClick={() => toggleOrder(order.id)}
                          className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 shadow-sm transition-all cursor-pointer"
                          title={expandedOrders.includes(order.id) ? "Recolher" : "Expandir"}
                        >
                          {expandedOrders.includes(order.id) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                          Total do Pedido
                        </div>
                        <div className="text-2xl font-black text-gray-950 tracking-tight">
                          {currencySymbol} {order.total.toFixed(2).replace('.', ',')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedOrders.includes(order.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-4"
                      >
                        <div className="bg-gray-50/95 rounded-xl p-4 space-y-3 border border-gray-200/80">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start border-b border-gray-200 last:border-0 pb-2 last:pb-0">
                              <div className="space-y-1">
                                <div className="font-bold text-gray-900">{item.quantity}x {item.title}{item.selectedSize ? ` (${item.selectedSize.name})` : ''}</div>
                                {item.cakeOptions && (
                                  <div className="text-xs text-gray-600 space-y-0.5">
                                    {item.cakeOptions.styleNumber && <div><span className="font-bold">Modelo:</span> {item.cakeOptions.styleNumber}</div>}
                                    {item.cakeOptions.size && <div><span className="font-bold">Tamanho:</span> {item.cakeOptions.size}</div>}
                                    {item.cakeOptions.dough && <div><span className="font-bold">Massa:</span> {item.cakeOptions.dough}</div>}
                                    {item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0 && (
                                      <div><span className="font-bold">Recheios:</span> {item.cakeOptions.fillings.join(', ')}</div>
                                    )}
                                    {item.cakeOptions.topping && <div><span className="font-bold">Cobertura:</span> {item.cakeOptions.topping}</div>}
                                    {item.cakeOptions.topper && <div><span className="font-bold">Topper:</span> {item.cakeOptions.topper}</div>}
                                    {item.cakeOptions.customReferenceDescription && (
                                      <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-950">
                                        <span className="font-bold block text-[10px] uppercase text-amber-800">Referência Desejada pelo Cliente:</span>
                                        <p className="text-xs italic mt-0.5">{item.cakeOptions.customReferenceDescription}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {item.sandwichOptions && item.sandwichOptions.fillings && item.sandwichOptions.fillings.length > 0 && (
                                  <div className="text-xs text-gray-600">
                                    <div><span className="font-bold">Recheios:</span> {item.sandwichOptions.fillings.join(', ')}</div>
                                  </div>
                                )}
                                {item.mealOptions && (
                                  <div className="text-xs text-gray-600 space-y-1">
                                    {item.mealOptions.removals.length > 0 && (
                                      <div><span className="font-bold">Ingredientes:</span> {item.mealOptions.removals.join(', ')}</div>
                                    )}
                                    {item.mealOptions.sides.length > 0 && (
                                      <div><span className="font-bold">Acompanhamentos:</span> {item.mealOptions.sides.map(s => s.name).join(', ')}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="font-black text-gray-900 text-sm">{currencySymbol} {(item.price * item.quantity).toFixed(2).replace('.', ',')}</div>
                            </div>
                          ))}
                          
                          {order.total > 0 && !(order.isB2B || order.isPJ) && (
                            <div className="border-t border-gray-200 pt-3 mt-3 space-y-1.5 text-xs text-gray-900 font-semibold">
                              <div className="flex justify-between">
                                <span className="text-gray-600 font-medium">Subtotal:</span>
                                <span className="font-bold text-gray-950">{currencySymbol} {(order.subtotal || (order.total / 1.0825)).toFixed(2).replace('.', ',')}</span>
                              </div>
                              <div className="flex justify-between text-amber-950">
                                <span className="text-gray-600 font-medium">Sales Tax (8.25%):</span>
                                <span className="font-bold text-amber-900">+ {currencySymbol} {(order.taxAmount || (order.total - (order.total / 1.0825))).toFixed(2).replace('.', ',')}</span>
                              </div>
                              <div className="flex justify-between text-base font-black text-gray-950 border-t-2 border-gray-200 pt-2">
                                <span className="text-gray-800 uppercase tracking-wide text-xs font-black">Total com Tax:</span>
                                <span className="text-2xl font-black text-gray-950 tracking-tight">{currencySymbol} {order.total.toFixed(2).replace('.', ',')}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                          <div className="space-y-1">
                            <div className="font-bold uppercase text-gray-500 text-[10px]">
                              {(order.isB2B || order.isPJ) ? "Endereço Comercial / Delivery" : "Endereço de Entrega/Retirada"}
                            </div>
                            <div className="p-3 bg-gray-50/95 rounded-lg border border-gray-200/80 font-medium text-gray-900">
                              {order.b2bAddress || order.address}
                            </div>
                          </div>

                          {(order.isB2B || order.isPJ) ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <div className="font-bold uppercase text-gray-500 text-[10px]">Responsável / Contato</div>
                                  <div className="p-2.5 bg-gray-100 rounded-lg border border-gray-200 font-bold text-gray-900">{order.b2bManagerName || 'N/A'}</div>
                                </div>
                                <div className="space-y-1">
                                  <div className="font-bold uppercase text-gray-500 text-[10px]">Frequência do Plano</div>
                                  <div className="p-2.5 bg-amber-500/10 text-amber-900 rounded-lg border border-amber-500/20 font-extrabold uppercase text-xs flex items-center justify-center text-center">
                                    {order.b2bFrequency === 'weekly' ? '🔄 Weekly' : '📦 One-Time'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}

                          <div className="space-y-1 md:col-span-2">
                            <div className="font-bold uppercase text-gray-500 text-[10px]">Observações / Requisitos Especiais</div>
                            <div className="p-3 bg-gray-50/95 rounded-lg border border-gray-200/80 italic text-gray-800">
                              {order.observation || 'Nenhuma observação informada.'}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
              {filteredOrders.length === 0 && (
                <div className="bg-white/95 backdrop-blur-md p-12 rounded-2xl border border-gray-200/80 shadow-sm text-center text-gray-500">
                  Nenhum pedido encontrado com os filtros aplicados.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'customers' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-3xl font-serif font-bold">Clientes</h2>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => setShowBirthdaysOnly(!showBirthdaysOnly)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all",
                  showBirthdaysOnly ? "bg-pink-500 text-white shadow-md" : "bg-white border border-gray-300 text-gray-600"
                )}
              >
                <Cake size={18} /> Aniversários da Semana
              </button>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-gray-200/90 shadow-sm">
            <input 
              type="text" 
              placeholder="Buscar por nome, telefone ou e-mail..."
              className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {uniqueCustomers
              .filter(c => {
                const matchesSearch = 
                  c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                  c.phone.includes(customerSearch) ||
                  c.email.toLowerCase().includes(customerSearch.toLowerCase());
                
                let matchesBirthday = true;
                if (showBirthdaysOnly) {
                  matchesBirthday = isBirthdayThisWeek(c.birthday, c.orderLanguage);
                }
                
                return matchesSearch && matchesBirthday;
              })
              .sort((a, b) => {
                const timeA = a.lastOrder?.toDate ? a.lastOrder.toDate().getTime() : 0;
                const timeB = b.lastOrder?.toDate ? b.lastOrder.toDate().getTime() : 0;
                return timeB - timeA;
              })
              .map((customer, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white/95 backdrop-blur-md p-6 rounded-[2rem] space-y-4 relative overflow-hidden group border border-gray-200/90 shadow-md text-gray-900 hover:shadow-lg transition-all"
                >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1 flex-grow pr-4">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-serif font-bold text-black">{customer.name}</h3>
                            {customer.isB2B && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black rounded-md border border-amber-200 uppercase tracking-wider">
                                PJ
                              </span>
                            )}
                          </div>
                          <a 
                            href={`https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                              `Olá, ${customer.name}! Tudo bem? Gostaria de falar com você sobre seu cadastro no ${settings?.brandName || 'Dendê Foods'}.`
                            )}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm opacity-60 hover:text-green-600 transition-colors"
                          >
                            <MessageCircle size={14} />
                            <span className="text-black">{customer.phone}</span>
                          </a>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button 
                            onClick={() => setViewingCustomerOrders(customer)}
                            className="bg-[#865d39]/10 hover:bg-[#865d39]/20 text-[#865d39] px-2.5 py-1 rounded-full text-xs font-black whitespace-nowrap cursor-pointer transition-all border border-[#865d39]/10"
                            title="Ver Histórico de Pedidos"
                          >
                            {customer.totalOrders} {customer.totalOrders === 1 ? 'Pedido' : 'Pedidos'}
                          </button>
                          <button 
                            onClick={() => {
                              setIsEditingCustomer(customer);
                              setEditCustomerForm({
                                name: customer.name,
                                phone: customer.phone,
                                email: customer.email,
                                birthday: customer.birthday,
                                address: customer.address,
                                isB2B: customer.isB2B,
                                managerName: customer.managerName,
                                street: customer.street,
                                number: customer.number,
                                zipCode: customer.zipCode,
                                city: customer.city,
                                frequency: customer.frequency
                              });
                            }}
                            className="p-1.5 text-blue-650 hover:bg-blue-50 hover:text-blue-700 bg-white shadow-sm border border-black/5 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                            title="Editar Cliente"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              setConfirmModal({
                                  isOpen: true,
                                  title: 'Excluir Cliente',
                                  message: `Tem certeza que deseja excluir o cliente ${customer.name} e todos os seus ${customer.totalOrders} pedidos?`,
                                  onConfirm: () => deleteCustomer(customer)
                              });
                            }}
                            className="p-1.5 text-red-650 hover:bg-red-50 hover:text-red-700 bg-white shadow-sm border border-black/5 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                            title="Excluir Cliente"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        {customer.email && (
                          <div className="flex items-center gap-2 opacity-70">
                            <span className="font-bold text-black">E-mail:</span>
                            <span className="text-black">{customer.email}</span>
                          </div>
                        )}
                        {customer.birthday && (() => {
                          const isBdayUpcoming = isBirthdayThisWeek(customer.birthday, customer.orderLanguage);
                          return (
                            <div className="space-y-2">
                              {isBdayUpcoming ? (
                                <>
                                  <div className="flex items-center gap-2 text-pink-600 font-bold">
                                    <Cake size={14} />
                                    <span>Aniversário: {customer.birthday} (Esta semana! 🎉)</span>
                                  </div>
                                  <div className="flex flex-col gap-1.5 p-3 bg-pink-500/10 border border-pink-500/20 rounded-2xl mt-1.5">
                                    <span className="text-[10px] uppercase font-black text-pink-800 tracking-wider">
                                      🎁 Enviar Mensagem de Feliz Aniversário:
                                    </span>
                                    <div className="w-full">
                                      <a 
                                        href={`https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                          `Parabéns, ${customer.name}! 🎉 A equipe do ${settings?.brandName || 'Dendê Foods'} te deseja um feliz aniversário! Que o seu dia seja repleto de alegria, paz e muito sabor. Como nosso presente para comemorar seu dia, preparamos uma oferta especial com surpresa no seu próximo pedido! 🎂🎁`
                                        )}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-green-650 hover:bg-green-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm border border-green-700/20"
                                      >
                                        <MessageCircle size={13} className="text-white" />
                                        <span>WhatsApp</span>
                                      </a>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center gap-2 opacity-70">
                                  <span className="font-bold text-black">Aniversário:</span>
                                  <span className="text-black">{customer.birthday}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {customer.address && (
                          <div className="flex items-start gap-2 opacity-70">
                            <span className="font-bold text-black">Endereço:</span>
                            <span className="line-clamp-2 text-black">{customer.address}</span>
                          </div>
                        )}
                      </div>

                  <div className="pt-4 border-t border-white/20 flex justify-between items-center text-xs opacity-50">
                    <span>Último pedido:</span>
                    <span>
                      {customer.lastOrder?.toDate 
                        ? customer.lastOrder.toDate().toLocaleDateString('en-US') 
                        : 'N/A'}
                    </span>
                  </div>
                </motion.div>
              ))}
          </div>
        </motion.div>
      )}
      </main>

      <AnimatePresence>
        {isEditingCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white/98 backdrop-blur-xl p-6 md:p-8 rounded-3xl w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-gray-200 text-gray-900"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-serif font-bold">Editar Cliente</h3>
                <button onClick={() => setIsEditingCustomer(null)} className="p-2 hover:bg-black/5 rounded-full">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={updateCustomer} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Nome do Cliente</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300"
                      value={editCustomerForm.name || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">WhatsApp</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300"
                      value={editCustomerForm.phone || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, phone: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">E-mail</label>
                    <input 
                      type="email" 
                      className="w-full p-3 rounded-xl border border-gray-300"
                      value={editCustomerForm.email || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Aniversário (MM/DD)</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300"
                      value={editCustomerForm.birthday || ''}
                      onChange={e => setEditCustomerForm({...editCustomerForm, birthday: e.target.value})}
                      placeholder="MM/DD"
                    />
                  </div>
                </div>
                {editCustomerForm.isB2B ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase opacity-60">Nome do Responsável</label>
                        <input 
                          type="text" 
                          className="w-full p-3 rounded-xl border border-gray-300 font-bold"
                          value={editCustomerForm.managerName || ''}
                          onChange={e => setEditCustomerForm({...editCustomerForm, managerName: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase opacity-60">Frequência de Pedidos</label>
                        <input 
                          type="text" 
                          className="w-full p-3 rounded-xl border border-gray-300"
                          value={editCustomerForm.frequency || ''}
                          onChange={e => setEditCustomerForm({...editCustomerForm, frequency: e.target.value})}
                          placeholder="Ex: Semanal, Mensal"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase opacity-60">Endereço Corporativo</label>
                      <input 
                        type="text" 
                        className="w-full p-3 rounded-xl border border-gray-300"
                        value={editCustomerForm.address || ''}
                        onChange={e => setEditCustomerForm({...editCustomerForm, address: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase opacity-60">CEP</label>
                        <input 
                          type="text" 
                          className="w-full p-3 rounded-xl border border-gray-300 font-mono"
                          value={editCustomerForm.zipCode || ''}
                          onChange={e => setEditCustomerForm({...editCustomerForm, zipCode: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase opacity-60">Cidade / Estado</label>
                        <input 
                          type="text" 
                          className="w-full p-3 rounded-xl border border-gray-300"
                          value={editCustomerForm.city || ''}
                          onChange={e => setEditCustomerForm({...editCustomerForm, city: e.target.value})}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-xs font-bold uppercase opacity-60">Rua / Logradouro</label>
                        <input 
                          type="text" 
                          className="w-full p-3 rounded-xl border border-gray-300"
                          value={editCustomerForm.street || ''}
                          onChange={e => setEditCustomerForm({...editCustomerForm, street: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase opacity-60">Número</label>
                        <input 
                          type="text" 
                          className="w-full p-3 rounded-xl border border-gray-300"
                          value={editCustomerForm.number || ''}
                          onChange={e => setEditCustomerForm({...editCustomerForm, number: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase opacity-60">CEP</label>
                        <input 
                          type="text" 
                          className="w-full p-3 rounded-xl border border-gray-300 font-mono"
                          value={editCustomerForm.zipCode || ''}
                          onChange={e => setEditCustomerForm({...editCustomerForm, zipCode: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase opacity-60">Cidade / Estado</label>
                        <input 
                          type="text" 
                          className="w-full p-3 rounded-xl border border-gray-300"
                          value={editCustomerForm.city || ''}
                          onChange={e => setEditCustomerForm({...editCustomerForm, city: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase opacity-60">Endereço Completo</label>
                      <input 
                        type="text" 
                        className="w-full p-3 rounded-xl border border-gray-300 opacity-80"
                        value={editCustomerForm.address || ''}
                        onChange={e => setEditCustomerForm({...editCustomerForm, address: e.target.value})}
                      />
                    </div>
                  </>
                )}
                 <button 
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : 'Salvar Alterações'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isEditingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto text-gray-900 border border-gray-200"
            >
              <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                <h3 className="text-2xl font-serif font-bold text-gray-900">Editar Pedido</h3>
                <button onClick={() => setIsEditingOrder(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-800 transition-colors cursor-pointer">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleEditOrder} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-600">Nome do Cliente</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900"
                      value={editOrderForm.customerName || ''}
                      onChange={e => setEditOrderForm({...editOrderForm, customerName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-600">WhatsApp</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900"
                      value={editOrderForm.phone || ''}
                      onChange={e => setEditOrderForm({...editOrderForm, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-600">Email</label>
                    <input 
                      type="email" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900"
                      value={editOrderForm.email || ''}
                      onChange={e => setEditOrderForm({...editOrderForm, email: e.target.value})}
                    />
                  </div>
                   <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-600">Aniversário (MM/DD)</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900"
                      value={editOrderForm.birthday || ''}
                      onChange={e => setEditOrderForm({...editOrderForm, birthday: e.target.value})}
                      placeholder="MM/DD"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-600">Endereço</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900"
                    value={editOrderForm.address || ''}
                    onChange={e => setEditOrderForm({...editOrderForm, address: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-600">Data de Entrega (Opcional)</label>
                    <input 
                      type="text" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900"
                      value={editOrderForm.pickupDate || ''}
                      onChange={e => setEditOrderForm({...editOrderForm, pickupDate: e.target.value})}
                      placeholder="MM/DD/AAAA"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-gray-600">Preço Final (Total)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">{currencySymbol}</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        className="w-full p-3 pl-12 rounded-xl border border-gray-300 bg-white font-bold text-blue-600"
                        value={editOrderForm.total || 0}
                        onChange={e => setEditOrderForm({...editOrderForm, total: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                {/* --- SEÇÃO DE ITENS DO PEDIDO --- */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-gray-800">Itens do Pedido</h4>
                  
                  {editOrderForm.items && editOrderForm.items.length > 0 ? (
                    <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-2">
                      {editOrderForm.items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-200 gap-3 text-gray-900">
                          <div className="flex-grow">
                            <p className="font-bold text-sm text-gray-900">{item.title}</p>
                            {item.selectedSize && (
                              <p className="text-xs text-gray-600 font-semibold">Tamanho: {item.selectedSize.name}</p>
                            )}
                            {item.sandwichOptions && item.sandwichOptions.fillings && item.sandwichOptions.fillings.length > 0 && (
                              <div className="text-xs text-gray-600 space-y-0.5 mt-0.5">
                                <p>Recheios: {item.sandwichOptions.fillings.join(', ')}</p>
                              </div>
                            )}
                            {item.cakeOptions && (
                              <div className="text-xs text-gray-600 space-y-0.5 mt-0.5">
                                {item.cakeOptions.size && <p>Tamanho: {item.cakeOptions.size}</p>}
                                {item.cakeOptions.dough && <p>Massa: {item.cakeOptions.dough}</p>}
                                {item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0 && (
                                  <p>Recheios: {item.cakeOptions.fillings.join(', ')}</p>
                                )}
                                {item.cakeOptions.topping && <p>Cobertura: {item.cakeOptions.topping}</p>}
                                {item.cakeOptions.topper && <p>Topper: {item.cakeOptions.topper}</p>}
                              </div>
                            )}
                            {item.mealOptions && (
                              <div className="text-xs text-gray-600 space-y-0.5 mt-0.5">
                                {item.mealOptions.removals && item.mealOptions.removals.length > 0 && (
                                  <p>Ingredientes: {item.mealOptions.removals.join(', ')}</p>
                                )}
                                {item.mealOptions.sides && item.mealOptions.sides.length > 0 && (
                                  <p>Extras: {item.mealOptions.sides.map(s => s.name).join(', ')}</p>
                                )}
                              </div>
                            )}
                            
                            {/* Editable price input for high usability */}
                            <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                              <span className="font-bold text-gray-600">Preço: {currencySymbol}</span>
                              <input 
                                type="number" 
                                step="0.01" 
                                className="w-20 px-2 py-0.5 rounded-lg border border-gray-300 bg-white text-gray-900 font-bold text-xs" 
                                value={item.price} 
                                onChange={e => {
                                  const newPrice = parseFloat(e.target.value) || 0;
                                  const updatedItems = [...(editOrderForm.items || [])];
                                  updatedItems[index].price = newPrice;
                                  updateOrderFormWithItems(updatedItems);
                                }} 
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden bg-white">
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedItems = [...(editOrderForm.items || [])];
                                  if (updatedItems[index].quantity > 1) {
                                    updatedItems[index].quantity -= 1;
                                    updateOrderFormWithItems(updatedItems);
                                  }
                                }}
                                className="px-2.5 py-1 hover:bg-gray-100 font-bold border-r border-gray-200 text-gray-800"
                              >
                                -
                              </button>
                              <span className="px-3 py-1 font-bold text-sm min-w-[24px] text-center text-gray-900">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedItems = [...(editOrderForm.items || [])];
                                  updatedItems[index].quantity += 1;
                                  updateOrderFormWithItems(updatedItems);
                                }}
                                className="px-2.5 py-1 hover:bg-gray-100 font-bold border-l border-gray-200 text-gray-800"
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const updatedItems = (editOrderForm.items || []).filter((_, idx) => idx !== index);
                                updateOrderFormWithItems(updatedItems);
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                              title="Excluir item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm opacity-50 italic text-gray-500">Nenhum item neste pedido.</p>
                  )}

                  {/* Add item interface */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-700">Adicionar Novo Item ao Pedido</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select
                        value={selectedProductId}
                        onChange={e => setSelectedProductId(e.target.value)}
                        className="flex-grow p-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900"
                      >
                        <option value="">-- Selecione um produto --</option>
                        {products.map(p => {
                          const activePrice = p.hasSizes && p.sizes && p.sizes.length > 0 
                            ? Math.min(...p.sizes.map(s => s.price)) 
                            : ((p.price && p.price > 0) ? p.price : (p.oldPrice || 0));
                          return (
                            <option key={p.id} value={p.id}>
                              {p.title} ({currencySymbol} {activePrice.toFixed(2)})
                            </option>
                          );
                        })}
                      </select>
                      
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          className="w-16 p-3 rounded-xl border border-gray-300 text-center font-bold text-gray-900 bg-white"
                          value={addItemQuantity}
                          onChange={e => setAddItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedProductId) return;
                            const prod = products.find(p => p.id === selectedProductId);
                            if (!prod) return;
                            
                            const activePrice = prod.hasSizes && prod.sizes && prod.sizes.length > 0 
                              ? Math.min(...prod.sizes.map(s => s.price)) 
                              : ((prod.price && prod.price > 0) ? prod.price : (prod.oldPrice || 0));
                            
                            const newItem = {
                              title: prod.title,
                              quantity: addItemQuantity,
                              price: activePrice,
                              cakeOptions: {},
                              mealOptions: {
                                removals: [],
                                sides: []
                              }
                            };
                            
                            const updatedItems = [...(editOrderForm.items || []), newItem];
                            updateOrderFormWithItems(updatedItems);
                            
                            // Reset selection
                            setSelectedProductId('');
                            setAddItemQuantity(1);
                          }}
                          disabled={!selectedProductId}
                          className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap uppercase tracking-wider cursor-pointer"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-gray-600">Observações</label>
                  <textarea 
                    className="w-full p-3 rounded-xl border border-gray-300 bg-white text-gray-900"
                    rows={3}
                    value={editOrderForm.observation || ''}
                    onChange={e => setEditOrderForm({...editOrderForm, observation: e.target.value})}
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 rounded-xl font-bold text-lg shadow-lg cursor-pointer"
                  style={{ 
                    backgroundColor: settings?.primaryColor || '#865d39',
                    color: getContrastText(settings?.primaryColor || '#865d39')
                  }}
                >
                  Salvar Alterações
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {viewingCustomerOrders && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-6 md:p-8 rounded-3xl w-full max-w-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto text-gray-900 border border-gray-200"
            >
              <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                <div className="space-y-1">
                  <span className="text-xs uppercase font-extrabold tracking-widest bg-[#865d39]/10 text-[#865d39] px-2.5 py-1 rounded-full border border-[#865d39]/10">
                    Histórico do Cliente
                  </span>
                  <h3 className="text-2xl font-serif font-bold text-gray-900">{viewingCustomerOrders.name}</h3>
                  <p className="text-sm text-gray-500 font-medium">
                    {viewingCustomerOrders.phone} | {viewingCustomerOrders.email || 'Sem e-mail'}
                  </p>
                </div>
                <button 
                  onClick={() => setViewingCustomerOrders(null)} 
                  className="p-2 hover:bg-gray-150 rounded-full text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500">
                  Pedidos Realizados ({viewingCustomerOrders.orders.length})
                </h4>
                
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                  {viewingCustomerOrders.orders.map((order: Order, index: number) => (
                    <div 
                      key={order.id} 
                      className="p-5 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white hover:shadow-md transition-all"
                    >
                      <div className="space-y-2 flex-grow">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 bg-gray-200 rounded text-gray-800">
                            #{order.id.slice(-6).toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500 font-medium">
                            {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('en-US') : 'N/A'}
                          </span>
                          {order.pickupDate && (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md text-white bg-gray-900 whitespace-nowrap shadow-xs">
                              {order.fulfillmentType === 'delivery' ? 'DELIVERY' : 'PICKUP'}: {order.pickupDate}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 text-sm">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between font-bold text-gray-900">
                              <span>{item.quantity}x {item.title}</span>
                              <span className="text-gray-800">{currencySymbol} {((item.price || 0) * item.quantity).toFixed(2).replace('.', ',')}</span>
                            </div>
                          ))}
                          
                          {order.total > 0 && (
                            <div className="border-t border-gray-200 pt-2 space-y-1 text-xs font-bold">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Subtotal:</span>
                                <span className="text-gray-900">{currencySymbol} {(order.subtotal || (order.total / 1.0825)).toFixed(2).replace('.', ',')}</span>
                              </div>
                              <div className="flex justify-between text-amber-900">
                                <span className="text-amber-800">Sales Tax (8.25%):</span>
                                <span className="font-black">+ {currencySymbol} {(order.taxAmount || (order.total - (order.total / 1.0825))).toFixed(2).replace('.', ',')}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {order.observation && (
                          <p className="text-xs italic bg-amber-50 text-amber-900 p-2.5 rounded-xl border border-amber-200 font-medium">
                            <strong>Obs:</strong> {order.observation}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-row md:flex-col items-end justify-between md:justify-center gap-3 border-t md:border-t-0 border-gray-200 pt-3 md:pt-0">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-black text-gray-500 tracking-wider block">VALOR PAGO</span>
                          <span className="text-2xl font-black text-gray-950 tracking-tight">
                            {currencySymbol} {order.total.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => printOrder(order)}
                            className="p-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 shadow-sm cursor-pointer"
                            title="Imprimir"
                          >
                            <Printer size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              setIsEditingOrder(order);
                              setEditOrderForm(order);
                              setViewingCustomerOrders(null);
                            }}
                            className="p-2 bg-white border border-gray-200 rounded-xl text-blue-600 hover:bg-blue-50 shadow-sm cursor-pointer"
                            title="Editar Pedido"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isCreatingManualOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 sm:p-8 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl text-black my-8 border border-gray-100"
            >
              <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-6">
                <div>
                  <h3 className="text-2xl font-serif font-bold text-gray-900">Inserir Novo Pedido Manual</h3>
                  <p className="text-xs text-gray-500 mt-1">Cadastre pedidos recebidos por telefone, WhatsApp ou balcão diretamente no sistema.</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsCreatingManualOrder(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-500 hover:text-gray-900 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveManualOrder} className="space-y-6">
                {/* Tipo de Cliente (Varejo / Corporativo) */}
                <div className="flex items-center gap-3 p-1.5 bg-gray-100 rounded-2xl w-max">
                  <button
                    type="button"
                    onClick={() => setManualOrderForm(prev => ({ ...prev, isB2B: false }))}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      !manualOrderForm.isB2B 
                        ? "bg-white text-gray-900 shadow-xs" 
                        : "text-gray-500 hover:text-gray-800"
                    )}
                  >
                    Cliente / Varejo
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualOrderForm(prev => ({ ...prev, isB2B: true }))}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      manualOrderForm.isB2B 
                        ? "bg-white text-gray-900 shadow-xs" 
                        : "text-gray-500 hover:text-gray-800"
                    )}
                  >
                    Empresa / Corporativo (B2B)
                  </button>
                </div>

                {/* Dados Corporativos se B2B */}
                {manualOrderForm.isB2B && (
                  <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/60 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">Dados da Empresa</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700">Nome da Empresa *</label>
                        <input 
                          type="text"
                          required={manualOrderForm.isB2B}
                          value={manualOrderForm.b2bCompanyName}
                          onChange={e => setManualOrderForm(prev => ({ ...prev, b2bCompanyName: e.target.value }))}
                          placeholder="Ex: Construtora Alpha Ltda"
                          className="w-full p-2.5 bg-white rounded-xl border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700">Responsável / Solicitante</label>
                        <input 
                          type="text"
                          value={manualOrderForm.b2bManagerName}
                          onChange={e => setManualOrderForm(prev => ({ ...prev, b2bManagerName: e.target.value }))}
                          placeholder="Ex: Carlos Oliveira"
                          className="w-full p-2.5 bg-white rounded-xl border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Dados do Cliente */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Informações do Cliente</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700">Nome Completo *</label>
                      <input 
                        type="text"
                        required
                        value={manualOrderForm.customerName}
                        onChange={e => setManualOrderForm(prev => ({ ...prev, customerName: e.target.value }))}
                        placeholder="Ex: João da Silva"
                        className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700">Telefone / WhatsApp</label>
                      <input 
                        type="text"
                        value={manualOrderForm.phone}
                        onChange={e => setManualOrderForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="(00) 00000-0000"
                        className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700">E-mail</label>
                      <input 
                        type="email"
                        value={manualOrderForm.email}
                        onChange={e => setManualOrderForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="cliente@email.com"
                        className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700">Aniversário (opcional)</label>
                      <input 
                        type="text"
                        value={manualOrderForm.birthday}
                        onChange={e => setManualOrderForm(prev => ({ ...prev, birthday: e.target.value }))}
                        placeholder="DD/MM ou DD/MM/AAAA"
                        className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Atendimento e Agendamento */}
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Atendimento & Data</h4>
                  
                  {/* Tipo de Atendimento: PICKUP vs DELIVERY */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setManualOrderForm(prev => ({ ...prev, fulfillmentType: 'pickup' }))}
                      className={cn(
                        "py-3.5 px-4 rounded-xl font-black text-sm border-2 transition-all flex items-center justify-center cursor-pointer text-black",
                        manualOrderForm.fulfillmentType === 'pickup'
                          ? "bg-amber-200/90 border-amber-600 shadow-sm"
                          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-black"
                      )}
                    >
                      PICKUP
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualOrderForm(prev => ({ ...prev, fulfillmentType: 'delivery' }))}
                      className={cn(
                        "py-3.5 px-4 rounded-xl font-black text-sm border-2 transition-all flex items-center justify-center cursor-pointer text-black",
                        manualOrderForm.fulfillmentType === 'delivery'
                          ? "bg-amber-200/90 border-amber-600 shadow-sm"
                          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-black"
                      )}
                    >
                      DELIVERY
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700">Data Agendada</label>
                      <input 
                        type="date"
                        value={manualOrderForm.scheduledDate}
                        onChange={e => setManualOrderForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                        className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-700">Horário</label>
                        <span className="text-[10px] text-gray-500 font-semibold">Formato 12h com AM/PM</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="text"
                          value={manualOrderForm.scheduledTime}
                          onChange={e => setManualOrderForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                          placeholder="Ex: 11:30 AM"
                          className="flex-1 p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                        <div className="flex rounded-xl overflow-hidden border border-gray-300 shrink-0 bg-gray-100 p-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setManualOrderForm(prev => {
                                let curr = (prev.scheduledTime || '').replace(/(\s*(AM|PM))*/gi, '').trim();
                                if (!curr) curr = '10:00';
                                return { ...prev, scheduledTime: `${curr} AM` };
                              });
                            }}
                            className={cn(
                              "px-2.5 py-1 text-xs font-black rounded-lg transition-all cursor-pointer",
                              manualOrderForm.scheduledTime?.toUpperCase().includes('AM')
                                ? "bg-amber-200 border border-amber-500 text-black shadow-xs"
                                : "text-gray-600 hover:text-black"
                            )}
                          >
                            AM
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setManualOrderForm(prev => {
                                let curr = (prev.scheduledTime || '').replace(/(\s*(AM|PM))*/gi, '').trim();
                                if (!curr) curr = '02:00';
                                return { ...prev, scheduledTime: `${curr} PM` };
                              });
                            }}
                            className={cn(
                              "px-2.5 py-1 text-xs font-black rounded-lg transition-all cursor-pointer",
                              manualOrderForm.scheduledTime?.toUpperCase().includes('PM')
                                ? "bg-amber-200 border border-amber-500 text-black shadow-xs"
                                : "text-gray-600 hover:text-black"
                            )}
                          >
                            PM
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {['10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'].map(timeSlot => (
                          <button
                            key={timeSlot}
                            type="button"
                            onClick={() => setManualOrderForm(prev => ({ ...prev, scheduledTime: timeSlot }))}
                            className={cn(
                              "text-[10px] font-black px-2 py-0.5 rounded-lg border transition-all cursor-pointer",
                              manualOrderForm.scheduledTime === timeSlot
                                ? "bg-amber-200 text-black border-amber-500 shadow-xs"
                                : "bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200"
                            )}
                          >
                            {timeSlot}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Endereço se Delivery */}
                  {manualOrderForm.fulfillmentType === 'delivery' && (
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-gray-600">Endereço de Entrega</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[11px] font-bold text-gray-600">Rua / Logradouro</label>
                          <input 
                            type="text"
                            value={manualOrderForm.street}
                            onChange={e => setManualOrderForm(prev => ({ ...prev, street: e.target.value }))}
                            placeholder="Ex: Main Street"
                            className="w-full p-2 bg-white rounded-xl border border-gray-200 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-gray-600">Número / Apto</label>
                          <input 
                            type="text"
                            value={manualOrderForm.number}
                            onChange={e => setManualOrderForm(prev => ({ ...prev, number: e.target.value }))}
                            placeholder="Ex: 120, Apt 4B"
                            className="w-full p-2 bg-white rounded-xl border border-gray-200 text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-gray-600">Cidade / Bairro</label>
                          <input 
                            type="text"
                            value={manualOrderForm.city}
                            onChange={e => setManualOrderForm(prev => ({ ...prev, city: e.target.value }))}
                            placeholder="Ex: Orlando"
                            className="w-full p-2 bg-white rounded-xl border border-gray-200 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-gray-600">CEP / ZIP</label>
                          <input 
                            type="text"
                            value={manualOrderForm.zipCode}
                            onChange={e => setManualOrderForm(prev => ({ ...prev, zipCode: e.target.value }))}
                            placeholder="Ex: 32801"
                            className="w-full p-2 bg-white rounded-xl border border-gray-200 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Itens do Pedido */}
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Itens do Pedido</h4>
                    <span className="text-xs font-bold text-gray-500">{manualOrderForm.items.length} {manualOrderForm.items.length === 1 ? 'item' : 'itens'}</span>
                  </div>

                  {/* Formulário para Adicionar Item */}
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                    <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Plus size={14} className="text-blue-600" /> Adicionar do Cardápio
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-6">
                        <select
                          value={manualSelectedProductId}
                          onChange={e => {
                            setManualSelectedProductId(e.target.value);
                            const prod = products.find(p => p.id === e.target.value);
                            if (prod?.hasSizes && prod.sizes && prod.sizes.length > 0) {
                              setManualSelectedSizeId(prod.sizes[0].name);
                            } else {
                              setManualSelectedSizeId('');
                            }
                          }}
                          className="w-full p-2.5 bg-white rounded-xl border border-gray-200 text-xs sm:text-sm"
                        >
                          <option value="">Selecione um produto...</option>
                          {products
                            .slice()
                            .sort((a, b) => a.title.localeCompare(b.title))
                            .map(prod => (
                              <option key={prod.id} value={prod.id}>
                                {prod.title} {prod.hasSizes ? '(c/ tamanhos)' : `- ${currencySymbol} ${prod.price.toFixed(2)}`}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Dropdown de Tamanho caso o produto selecionado tenha tamanhos */}
                      {(() => {
                        const prod = products.find(p => p.id === manualSelectedProductId);
                        if (prod?.hasSizes && prod.sizes && prod.sizes.length > 0) {
                          return (
                            <div className="sm:col-span-3">
                              <select
                                value={manualSelectedSizeId}
                                onChange={e => setManualSelectedSizeId(e.target.value)}
                                className="w-full p-2.5 bg-white rounded-xl border border-gray-200 text-xs sm:text-sm font-semibold text-blue-700"
                              >
                                {prod.sizes.map(size => (
                                  <option key={size.name} value={size.name}>
                                    {size.name} - {currencySymbol} {Number(size.price).toFixed(2)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      <div className={(() => {
                        const prod = products.find(p => p.id === manualSelectedProductId);
                        return prod?.hasSizes && prod.sizes && prod.sizes.length > 0 ? "sm:col-span-3 flex gap-2" : "sm:col-span-6 flex gap-2";
                      })()}>
                        <div className="flex items-center border border-gray-200 bg-white rounded-xl px-2 shrink-0">
                          <span className="text-[11px] font-bold text-gray-400 mr-1.5">Qtd:</span>
                          <input 
                            type="number"
                            min="1"
                            value={manualItemQuantity}
                            onChange={e => setManualItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-12 text-center text-sm font-bold bg-transparent outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={!manualSelectedProductId}
                          onClick={() => {
                            if (!manualSelectedProductId) return;
                            const prod = products.find(p => p.id === manualSelectedProductId);
                            if (!prod) return;

                            let itemTitle = prod.title;
                            let itemPrice = prod.price || 0;
                            let selectedSizeObj: any = undefined;

                            if (prod.hasSizes && prod.sizes && prod.sizes.length > 0) {
                              const size = prod.sizes.find(s => s.name === manualSelectedSizeId) || prod.sizes[0];
                              if (size) {
                                itemTitle = `${prod.title} (${size.name})`;
                                itemPrice = size.price;
                                selectedSizeObj = { name: size.name, price: size.price };
                              }
                            }

                            const newItem = {
                              title: itemTitle,
                              quantity: Math.max(1, manualItemQuantity),
                              price: itemPrice,
                              selectedSize: selectedSizeObj
                            };

                            setManualOrderForm(prev => ({
                              ...prev,
                              items: [...prev.items, newItem]
                            }));

                            setManualSelectedProductId('');
                            setManualSelectedSizeId('');
                            setManualItemQuantity(1);
                          }}
                          className="flex-1 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Plus size={14} /> Adicionar
                        </button>
                      </div>
                    </div>

                    {/* Ou adicionar item avulso */}
                    <div className="pt-2 border-t border-gray-200/80">
                      <div className="text-[11px] font-bold text-gray-500 mb-2">Ou adicione um item avulso/encomenda especial:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-6">
                          <input 
                            type="text"
                            value={manualCustomTitle}
                            onChange={e => setManualCustomTitle(e.target.value)}
                            placeholder="Nome do item (ex: Cento de Salgados)"
                            className="w-full p-2 bg-white rounded-xl border border-gray-200 text-xs sm:text-sm"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">{currencySymbol}</span>
                            <input 
                              type="text"
                              value={manualCustomPrice}
                              onChange={e => setManualCustomPrice(e.target.value)}
                              placeholder="0,00"
                              className="w-full pl-8 pr-2 py-2 bg-white rounded-xl border border-gray-200 text-xs sm:text-sm font-mono font-bold"
                            />
                          </div>
                        </div>
                        <div className="sm:col-span-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (!manualCustomTitle.trim()) {
                                toast.error('Digite o nome do item avulso.');
                                return;
                              }
                              const parsedPrice = parseFloat(manualCustomPrice.replace(',', '.')) || 0;
                              const newItem = {
                                title: manualCustomTitle.trim(),
                                quantity: 1,
                                price: parsedPrice
                              };
                              setManualOrderForm(prev => ({
                                ...prev,
                                items: [...prev.items, newItem]
                              }));
                              setManualCustomTitle('');
                              setManualCustomPrice('');
                            }}
                            className="w-full py-2 bg-gray-800 hover:bg-black text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
                          >
                            + Item Avulso
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lista dos Itens Adicionados */}
                  {manualOrderForm.items.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 text-xs">
                      Nenhum item adicionado ainda. Escolha no cardápio acima ou insira um item avulso.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {manualOrderForm.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs sm:text-sm gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900 truncate">{it.title}</div>
                            <div className="text-[11px] text-gray-500">
                              Unitário: {currencySymbol} {it.price.toFixed(2)} &bull; Subtotal: <strong className="text-gray-800">{currencySymbol} {(it.price * it.quantity).toFixed(2)}</strong>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  if (it.quantity <= 1) {
                                    setManualOrderForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
                                  } else {
                                    setManualOrderForm(prev => ({
                                      ...prev,
                                      items: prev.items.map((item, i) => i === idx ? { ...item, quantity: item.quantity - 1 } : item)
                                    }));
                                  }
                                }}
                                className="px-2 py-1 hover:bg-gray-100 text-gray-600 font-bold cursor-pointer"
                              >
                                -
                              </button>
                              <span className="px-2 py-1 font-bold text-xs min-w-[24px] text-center">{it.quantity}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setManualOrderForm(prev => ({
                                    ...prev,
                                    items: prev.items.map((item, i) => i === idx ? { ...item, quantity: item.quantity + 1 } : item)
                                  }));
                                }}
                                className="px-2 py-1 hover:bg-gray-100 text-gray-600 font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setManualOrderForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                              title="Remover item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resumo Financeiro & Totais */}
                {(() => {
                  const subtotal = manualOrderForm.items.reduce((acc, it) => acc + (it.price * it.quantity), 0);
                  const taxAmount = manualOrderForm.applyTax ? (subtotal * (manualOrderForm.taxRate / 100)) : 0;
                  const computedTotal = subtotal + taxAmount;
                  const finalTotal = manualOrderForm.totalOverride && parseFloat(manualOrderForm.totalOverride) >= 0
                    ? parseFloat(manualOrderForm.totalOverride)
                    : computedTotal;

                  return (
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                      <div className="flex justify-between items-center text-xs text-gray-600">
                        <span>Subtotal dos Itens:</span>
                        <span className="font-mono font-bold text-gray-800">{currencySymbol} {subtotal.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs text-gray-600">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            checked={manualOrderForm.applyTax}
                            onChange={e => setManualOrderForm(prev => ({ ...prev, applyTax: e.target.checked }))}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span>Aplicar Taxa / Imposto ({manualOrderForm.taxRate}%):</span>
                        </label>
                        <span className="font-mono font-bold text-gray-800">+{currencySymbol} {taxAmount.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-200">
                        <div className="text-xs text-gray-500">
                          <label className="block text-[11px] font-bold text-gray-600 mb-0.5">Ajustar Total Manualmente (opcional)</label>
                          <div className="relative w-32">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">{currencySymbol}</span>
                            <input 
                              type="text"
                              value={manualOrderForm.totalOverride}
                              onChange={e => setManualOrderForm(prev => ({ ...prev, totalOverride: e.target.value }))}
                              placeholder={computedTotal.toFixed(2)}
                              className="w-full pl-6 pr-2 py-1 bg-white rounded-lg border border-gray-200 text-xs font-mono font-bold"
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Total do Pedido</span>
                          <span className="text-2xl font-serif font-black text-green-700">
                            {currencySymbol} {finalTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Observações */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Observações do Pedido</label>
                  <textarea 
                    rows={2}
                    value={manualOrderForm.observation}
                    onChange={e => setManualOrderForm(prev => ({ ...prev, observation: e.target.value }))}
                    placeholder="Instruções especiais, troco para quanto, recados para entrega..."
                    className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingManualOrder(false)}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-sm transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} /> Salvar Pedido
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-serif font-bold">{confirmModal.title}</h3>
                <p className="text-sm opacity-60">{confirmModal.message}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3 rounded-xl bg-gray-100 font-bold text-black cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold shadow-lg"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
