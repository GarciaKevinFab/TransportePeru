import React, { useState, useEffect } from 'react';
import { inventoryApi, suppliersApi } from '../services/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Package,
  Plus,
  Loader2,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  Building,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

const InventoryPage = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [itemForm, setItemForm] = useState({
    code: '',
    name: '',
    description: '',
    category: 'repuesto',
    unit: 'unidad',
    min_stock: '',
    max_stock: '',
    unit_cost: '',
    location: '',
  });
  
  const [moveForm, setMoveForm] = useState({
    move_type: 'entrada',
    quantity: '',
    unit_cost: '',
    notes: '',
  });
  
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    ruc: '',
    phone: '',
    email: '',
    address: '',
    category: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [itemsRes, suppliersRes] = await Promise.all([
        inventoryApi.getItems({ low_stock: showLowStock }),
        suppliersApi.getAll(),
      ]);
      setItems(itemsRes.data);
      setSuppliers(suppliersRes.data);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [showLowStock]);

  const filteredItems = items.filter(
    item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateItem = async () => {
    setSaving(true);
    try {
      await inventoryApi.createItem({
        ...itemForm,
        min_stock: parseInt(itemForm.min_stock) || 0,
        max_stock: parseInt(itemForm.max_stock) || null,
        unit_cost: parseFloat(itemForm.unit_cost) || 0,
      });
      toast.success('Item creado exitosamente');
      setShowItemDialog(false);
      setItemForm({
        code: '',
        name: '',
        description: '',
        category: 'repuesto',
        unit: 'unidad',
        min_stock: '',
        max_stock: '',
        unit_cost: '',
        location: '',
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear item');
    }
    setSaving(false);
  };

  const handleCreateMove = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      await inventoryApi.createMove({
        item_id: selectedItem.id,
        ...moveForm,
        quantity: parseInt(moveForm.quantity),
        unit_cost: parseFloat(moveForm.unit_cost) || selectedItem.unit_cost,
      });
      toast.success('Movimiento registrado');
      setShowMoveDialog(false);
      setMoveForm({ move_type: 'entrada', quantity: '', unit_cost: '', notes: '' });
      setSelectedItem(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrar movimiento');
    }
    setSaving(false);
  };

  const handleCreateSupplier = async () => {
    setSaving(true);
    try {
      await suppliersApi.create(supplierForm);
      toast.success('Proveedor creado');
      setShowSupplierDialog(false);
      setSupplierForm({ name: '', ruc: '', phone: '', email: '', address: '', category: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear proveedor');
    }
    setSaving(false);
  };

  const lowStockItems = items.filter(i => i.current_stock <= i.min_stock);

  return (
    <div className="space-y-6 page-fade-in" data-testid="inventory-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900">
            Inventario
          </h1>
          <p className="text-slate-500 mt-1">
            Gestión de repuestos, stock y proveedores
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" className="btn-press" onClick={() => setShowSupplierDialog(true)}>
            <Building className="w-4 h-4 mr-2" />
            Nuevo Proveedor
          </Button>
          <Button className="btn-action btn-press" onClick={() => setShowItemDialog(true)} data-testid="new-item-btn">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Item
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-l-4 border-l-blue-500 card-enter card-stagger-1">
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Total Items</p>
            <p className="font-heading text-3xl font-bold text-blue-600 mt-1">{items.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-red-500 card-enter card-stagger-2">
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Stock Bajo</p>
            <p className="font-heading text-3xl font-bold text-red-600 mt-1">{lowStockItems.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-green-500 card-enter card-stagger-3">
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Valor Total</p>
            <p className="font-heading text-3xl font-bold text-green-600 mt-1">
              S/ {items.reduce((a, b) => a + (b.current_stock * b.unit_cost), 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border-l-4 border-l-orange-500 card-enter card-stagger-4">
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Proveedores</p>
            <p className="font-heading text-3xl font-bold text-orange-600 mt-1">{suppliers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="items">
        <TabsList className="bg-slate-100 rounded-sm">
          <TabsTrigger value="items" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            Inventario
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white font-bold uppercase text-xs tracking-wide">
            Proveedores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4">
          {/* Filters */}
          <Card className="bg-white mb-4">
            <CardContent className="py-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por código o nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 rounded-sm"
                  />
                </div>
                <Button
                  variant={showLowStock ? 'default' : 'outline'}
                  onClick={() => setShowLowStock(!showLowStock)}
                  className={showLowStock ? 'bg-red-500 hover:bg-red-600' : ''}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Stock Bajo ({lowStockItems.length})
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white section-enter">
            <CardContent className="p-0 overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Package className="w-12 h-12 mb-2" />
                  <p>No hay items en inventario</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="table-dense">
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Min/Max</TableHead>
                      <TableHead>Costo Unit.</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id} className="table-dense">
                        <TableCell className="font-mono font-bold">{item.code}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {item.location && (
                              <p className="text-xs text-slate-500">Ubic: {item.location}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold ${item.current_stock <= item.min_stock ? 'text-red-600' : 'text-green-600'}`}>
                            {item.current_stock} {item.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {item.min_stock} / {item.max_stock || '∞'}
                        </TableCell>
                        <TableCell>S/ {item.unit_cost?.toFixed(2)}</TableCell>
                        <TableCell className="font-bold">
                          S/ {(item.current_stock * item.unit_cost).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedItem(item);
                                setMoveForm({ ...moveForm, move_type: 'entrada', unit_cost: item.unit_cost?.toString() || '' });
                                setShowMoveDialog(true);
                              }}
                            >
                              <ArrowUpCircle className="w-4 h-4 mr-1" />
                              Entrada
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedItem(item);
                                setMoveForm({ ...moveForm, move_type: 'salida' });
                                setShowMoveDialog(true);
                              }}
                            >
                              <ArrowDownCircle className="w-4 h-4 mr-1" />
                              Salida
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <Card className="bg-white section-enter">
            <CardContent className="p-0 overflow-x-auto">
              {suppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Building className="w-12 h-12 mb-2" />
                  <p>No hay proveedores registrados</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="table-dense">
                      <TableHead>Nombre</TableHead>
                      <TableHead>RUC</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Categoría</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier) => (
                      <TableRow key={supplier.id} className="table-dense">
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell className="font-mono">{supplier.ruc || '-'}</TableCell>
                        <TableCell>{supplier.phone || '-'}</TableCell>
                        <TableCell>{supplier.email || '-'}</TableCell>
                        <TableCell>
                          {supplier.category && <Badge variant="outline">{supplier.category}</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Nuevo Item
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Código *</Label>
                <Input
                  value={itemForm.code}
                  onChange={(e) => setItemForm({ ...itemForm, code: e.target.value.toUpperCase() })}
                  className="rounded-sm uppercase"
                  data-testid="item-code-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Categoría</Label>
                <Select value={itemForm.category} onValueChange={(v) => setItemForm({ ...itemForm, category: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="repuesto">Repuesto</SelectItem>
                    <SelectItem value="lubricante">Lubricante</SelectItem>
                    <SelectItem value="filtro">Filtro</SelectItem>
                    <SelectItem value="llanta">Llanta</SelectItem>
                    <SelectItem value="herramienta">Herramienta</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Nombre *</Label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                className="rounded-sm"
                data-testid="item-name-input"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Unidad</Label>
                <Select value={itemForm.unit} onValueChange={(v) => setItemForm({ ...itemForm, unit: v })}>
                  <SelectTrigger className="rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidad">Unidad</SelectItem>
                    <SelectItem value="litro">Litro</SelectItem>
                    <SelectItem value="galon">Galón</SelectItem>
                    <SelectItem value="kg">Kg</SelectItem>
                    <SelectItem value="metro">Metro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="input-label">Stock Mínimo</Label>
                <Input
                  type="number"
                  value={itemForm.min_stock}
                  onChange={(e) => setItemForm({ ...itemForm, min_stock: e.target.value })}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Stock Máximo</Label>
                <Input
                  type="number"
                  value={itemForm.max_stock}
                  onChange={(e) => setItemForm({ ...itemForm, max_stock: e.target.value })}
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Costo Unitario</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={itemForm.unit_cost}
                  onChange={(e) => setItemForm({ ...itemForm, unit_cost: e.target.value })}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Ubicación</Label>
                <Input
                  value={itemForm.location}
                  onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })}
                  placeholder="Estante A-1"
                  className="rounded-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>Cancelar</Button>
            <Button 
              className="btn-action" 
              onClick={handleCreateItem}
              disabled={!itemForm.code || !itemForm.name || saving}
              data-testid="save-item-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Move Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              {moveForm.move_type === 'entrada' ? 'Entrada' : 'Salida'} de Stock
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-500 mb-4">
              Item: <strong>{selectedItem?.name}</strong> ({selectedItem?.code})
            </p>
            <p className="text-sm text-slate-500 mb-4">
              Stock actual: <strong>{selectedItem?.current_stock} {selectedItem?.unit}</strong>
            </p>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label className="input-label">Cantidad *</Label>
                <Input
                  type="number"
                  value={moveForm.quantity}
                  onChange={(e) => setMoveForm({ ...moveForm, quantity: e.target.value })}
                  className="rounded-sm"
                  data-testid="move-quantity-input"
                />
              </div>
              {moveForm.move_type === 'entrada' && (
                <div className="space-y-2">
                  <Label className="input-label">Costo Unitario</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={moveForm.unit_cost}
                    onChange={(e) => setMoveForm({ ...moveForm, unit_cost: e.target.value })}
                    className="rounded-sm"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label className="input-label">Notas</Label>
                <Input
                  value={moveForm.notes}
                  onChange={(e) => setMoveForm({ ...moveForm, notes: e.target.value })}
                  placeholder="Motivo del movimiento"
                  className="rounded-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>Cancelar</Button>
            <Button 
              className="btn-action" 
              onClick={handleCreateMove}
              disabled={!moveForm.quantity || saving}
              data-testid="save-move-btn"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Dialog */}
      <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Nuevo Proveedor
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Nombre *</Label>
                <Input
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">RUC</Label>
                <Input
                  value={supplierForm.ruc}
                  onChange={(e) => setSupplierForm({ ...supplierForm, ruc: e.target.value })}
                  className="rounded-sm font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="input-label">Teléfono</Label>
                <Input
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  className="rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="input-label">Email</Label>
                <Input
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  className="rounded-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="input-label">Categoría</Label>
              <Select value={supplierForm.category} onValueChange={(v) => setSupplierForm({ ...supplierForm, category: v })}>
                <SelectTrigger className="rounded-sm">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="repuestos">Repuestos</SelectItem>
                  <SelectItem value="combustible">Combustible</SelectItem>
                  <SelectItem value="llantas">Llantas</SelectItem>
                  <SelectItem value="lubricantes">Lubricantes</SelectItem>
                  <SelectItem value="servicios">Servicios</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSupplierDialog(false)}>Cancelar</Button>
            <Button 
              className="btn-action" 
              onClick={handleCreateSupplier}
              disabled={!supplierForm.name || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Proveedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryPage;
