"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useTheme } from "@/app/ThemeContext"
import { MoreHorizontal, ShieldCheck, UserPlus, Circle, Activity, Ban, Trash2, Search, Inbox, Wifi, WifiOff, RefreshCw } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

interface StaffMember {
  id: number
  email: string
  name: string
  phone: string | null
  role: string
  status: string
  is_online: boolean
  is_available: boolean
  last_login: string | null
  ordersHandled: number
}

export default function TeamManagement() {
  const { theme } = useTheme()
  const light = theme === "light"
  
  const tc = {
    card: "bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 shadow-sm",
    text: "text-slate-900 dark:text-slate-50",
    textMuted: "text-slate-500 dark:text-slate-400",
    input: "bg-white dark:bg-[#0f172a] border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus-visible:ring-brand-500",
    modal: "bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800",
    hover: "hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors duration-200",
    select: "bg-white dark:bg-[#0f172a] border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 focus-visible:ring-brand-500",
  }

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Slide-out state
  const [selectedUser, setSelectedUser] = useState<StaffMember | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [userOrders, setUserOrders] = useState({ current_orders: [], past_orders: [] })

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPhone, setNewPhone] = useState("") 
  const [newRole, setNewRole] = useState("staff")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Edit state (inside slide-out sheet)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editRole, setEditRole] = useState("staff")
  const [isEditSubmitting, setIsEditSubmitting] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState("all")
  const [sortKey, setSortKey] = useState("orders_desc")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isRebalancing, setIsRebalancing] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    fetchStaff()
    const intervalId = setInterval(fetchStaff, 60000);
    return () => clearInterval(intervalId);
  }, [])

  const fetchStaff = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch staff")
      const data = await res.json()
      setStaff(data)
    } catch (error) {
      toast.error("Impossible de charger l'annuaire du personnel.")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSuspend = async (userId: number) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${userId}/toggle-status`, { 
        method: "PATCH",
        credentials: "include" 
      })
      if (!res.ok) throw new Error("Failed to update status")
      toast.success(`Accès de l'utilisateur mis à jour avec succès.`)
      fetchStaff()
      queryClient.invalidateQueries({ queryKey: ["staff"] })
    } catch (error: any) {
      toast.error(error.message || "Échec de la mise à jour du statut")
    }
  }

  const toggleAvailability = async (userId: number, currentValue: boolean) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${userId}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_available: !currentValue }),
      })
      if (!res.ok) throw new Error("Failed to update availability")
      toast.success(`Disponibilité mise à jour.`)
      fetchStaff()
    } catch (error: any) {
      toast.error(error.message || "Échec de la mise à jour de la disponibilité")
    }
  }

  const handleRebalance = async () => {
    if (isRebalancing) return
    setIsRebalancing(true)
    // Backend rebalance is synchronous and often finishes in <50ms, so the
    // spinner would flash imperceptibly. Hold it for a minimum visible window
    // so the admin always sees the redistribution happen.
    const minSpin = new Promise((r) => setTimeout(r, 900))
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/rebalance`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to rebalance")
      const data = await res.json()
      const n = data.redistributed
      if (n > 0) {
        toast.success(`${n} commande${n !== 1 ? "s" : ""} redistribuée${n !== 1 ? "s" : ""} entre les agents disponibles.`)
      } else {
        toast.info("Aucune commande à redistribuer.")
      }
      // Refresh so the new per-agent order counts show immediately.
      await fetchStaff()
      queryClient.invalidateQueries({ queryKey: ["staff"] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      await minSpin
    } catch (error: any) {
      await minSpin
      toast.error(error.message || "Échec de la redistribution")
    } finally {
      setIsRebalancing(false)
    }
  }

  const bulkSuspendToggle = async (userIds: number[]) => {
    if (userIds.length === 0) return
    try {
      await Promise.all(
        userIds.map((id) => fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${id}/toggle-status`, {
          method: "PATCH",
          credentials: "include"
        }))
      )
      toast.success("Comptes sélectionnés mis à jour avec succès.")
      fetchStaff()
      queryClient.invalidateQueries({ queryKey: ["staff"] })
      setSelectedIds(new Set())
    } catch (error: any) {
      toast.error(error.message || "Échec de la mise à jour des utilisateurs sélectionnés")
    }
  }

  const bulkRevoke = async (userIds: number[]) => {
    if (userIds.length === 0) return
    if (!confirm(`Révoquer l'accès de ${userIds.length} utilisateur(s) ? Cette action est irréversible.`)) return
    try {
      await Promise.all(
        userIds.map((id) => fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${id}`, {
          method: "DELETE",
          credentials: "include"
        }))
      )
      toast.success("Accès des utilisateurs sélectionnés révoqué avec succès.")
      fetchStaff()
      setSelectedIds(new Set())
    } catch (error: any) {
      toast.error(error.message || "Échec de la révocation des utilisateurs sélectionnés")
    }
  }

  const handleRevoke = async (userId: number) => {
    if (!confirm("Êtes-vous sûr de vouloir révoquer définitivement l'accès de cet utilisateur ?")) return;
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${userId}`, { 
        method: "DELETE",
        credentials: "include" 
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to revoke access.")
      }
      
      toast.success("Membre du personnel supprimé avec succès.")
      fetchStaff() // Refresh the table
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const openUserDetails = async (user: StaffMember) => {
    setSelectedUser(user)
    setEditName(user.name)
    setEditEmail(user.email)
    setEditPhone(user.phone || "")
    setEditRole(user.role)
    setIsDetailsOpen(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${user.id}`, { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setUserOrders({ current_orders: data.current_orders, past_orders: data.past_orders })
      }
    } catch (error) {
      toast.error("Impossible de charger l'historique des commandes de l'utilisateur.")
    }
  }

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    setIsEditSubmitting(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.toLowerCase().trim(),
          phone: editPhone.trim(),
          role: editRole,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update")
      }
      toast.success("Membre du personnel mis à jour.")
      fetchStaff()
      setIsDetailsOpen(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsEditSubmitting(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newEmail.trim()) {
      toast.error("Nom et e-mail requis")
      return
    }
    setIsSubmitting(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.toLowerCase().trim(), name: newName.trim(), role: newRole, phone: newPhone.trim() }),
        credentials: "include"
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to add member")
      }
      
      toast.success(`${newName} autorisé(e) avec succès en tant que ${newRole} !`)
      setIsAddModalOpen(false) 
      setNewName("")             
      setNewEmail("")
      setNewRole("staff")
      setNewPhone("")
      fetchStaff()             
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredStaff = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    const base = staff.filter((user) => {
      if (statusFilter === "active") return user.status === "Active"
      if (statusFilter === "suspended") return user.status !== "Active"
      return true
    })

    const roleFiltered = base.filter((user) => {
      if (roleFilter === "admin") return user.role === "admin"
      if (roleFilter === "staff") return user.role !== "admin"
      return true
    })

    const searched = normalizedQuery
      ? roleFiltered.filter((user) => [user.name, user.email, user.phone].some((val) =>
          (val || "").toLowerCase().includes(normalizedQuery)
        ))
      : roleFiltered

    const sorted = [...searched].sort((a, b) => {
      if (sortKey === "orders_desc") return b.ordersHandled - a.ordersHandled
      if (sortKey === "orders_asc") return a.ordersHandled - b.ordersHandled
      return a.name.localeCompare(b.name)
    })

    return sorted
  }, [staff, searchQuery, statusFilter, roleFilter, sortKey])

  const selectableIds = useMemo(() => filteredStaff.map((user) => user.id), [filteredStaff])
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))
  const selectedUsers = useMemo(
    () => staff.filter((user) => selectedIds.has(user.id)),
    [staff, selectedIds]
  )
  const hasSelection = selectedUsers.length > 0
  const selectedActiveIds = selectedUsers.filter((user) => user.status === "Active").map((user) => user.id)
  const selectedSuspendedIds = selectedUsers.filter((user) => user.status !== "Active").map((user) => user.id)

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allSelected) {
        const next = new Set(prev)
        selectableIds.forEach((id) => next.delete(id))
        return next
      }
      const next = new Set(prev)
      selectableIds.forEach((id) => next.add(id))
      return next
    })
  }

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Chargement de l'annuaire du personnel…</div>

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      <div className={`rounded-2xl border px-6 py-5 ${tc.card}`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-semibold tracking-tight ${tc.text}`}>Gestion de l'équipe</h1>
          <p className={`text-sm ${tc.textMuted}`}>Gérer les accès et surveiller l'activité du personnel.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRebalance} disabled={isRebalancing} title="Redistribuer les commandes assignées mais non démarrées entre les agents disponibles">
            <RefreshCw className={`mr-2 h-4 w-4 ${isRebalancing ? "animate-spin" : ""}`} />
            {isRebalancing ? "Redistribution…" : "Redistribuer les commandes"}
          </Button>
          <Button className="bg-brand-600 hover:bg-brand-700 transition-colors" onClick={() => setIsAddModalOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Ajouter un membre
          </Button>
        </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className={`${tc.card}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className={`text-xs font-semibold uppercase tracking-wider ${tc.textMuted}`}>Total Personnel</CardTitle>
            <ShieldCheck className={`h-4 w-4 ${tc.textMuted}`} />
          </CardHeader>
          <CardContent><div className={`text-2xl font-semibold ${tc.text}`}>{staff.length}</div></CardContent>
        </Card>
        <Card className={`${tc.card}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className={`text-xs font-semibold uppercase tracking-wider ${tc.textMuted}`}>En ligne maintenant</CardTitle>
            <Activity className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent><div className={`text-2xl font-semibold ${tc.text}`}>{staff.filter(s => s.is_online).length}</div></CardContent>
        </Card>
        <Card className={`${tc.card}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className={`text-xs font-semibold uppercase tracking-wider ${tc.textMuted}`}>Commandes totales</CardTitle>
            <Circle className="h-4 w-4 text-brand-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold ${tc.text}`}>{staff.reduce((acc, curr) => acc + curr.ordersHandled, 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className={`${tc.card}`}>
        <CardHeader className="space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <CardTitle className={`${tc.text}`}>Annuaire du personnel</CardTitle>
              <CardDescription className={`${tc.textMuted}`}>Liste complète de tout le personnel et leur charge opérationnelle actuelle.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${tc.textMuted}`} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher nom, e-mail, téléphone"
                  className={`h-10 w-64 max-w-full rounded-md border pl-9 pr-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 ${tc.input}`}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`h-10 rounded-md border px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 ${tc.select}`}
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actif</option>
                <option value="suspended">Suspendu</option>
              </select>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className={`h-10 rounded-md border px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 ${tc.select}`}
              >
                <option value="all">Tous les rôles</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className={`h-10 rounded-md border px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 ${tc.select}`}
              >
                <option value="orders_desc">Commandes décroissant</option>
                <option value="orders_asc">Commandes croissant</option>
                <option value="name_asc">Nom A-Z</option>
              </select>
            </div>
          </div>
          <div className={`flex items-center justify-between text-xs ${tc.textMuted}`}>
            <span>{filteredStaff.length} membres du personnel</span>
            <span>Mise à jour toutes les 60 secondes</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow className="border-muted-foreground/20">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Identité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Disponibilité</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead className="text-center">Commandes traitées</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Aucun membre du personnel ne correspond à ces filtres.
                  </TableCell>
                </TableRow>
              ) : filteredStaff.map((user) => (
                <TableRow key={user.id} className={`border-muted-foreground/20 ${tc.hover}`}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleSelectOne(user.id)}
                      aria-label={`Select ${user.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {/* WRAPPED THE AVATAR IN A LINK */}
                      <Link 
                        href={`/staff/${user.id}`} 
                        className="relative block cursor-pointer group transition-transform hover:scale-105"
                        title={`Voir le profil de ${user.name}`}
                      >
                        <Avatar className="h-9 w-9 border border-muted group-hover:ring-2 ring-brand-500 ring-offset-2 ring-offset-[#0B0F1A] transition-all">
                          <AvatarFallback className="bg-muted text-foreground">
                            {user.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-transparent ${user.is_online ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                      </Link>
                      <div className="flex flex-col">
                        <span className={`${tc.text}`}>{user.name}</span>
                        <span className={`text-xs ${tc.textMuted}`}>{user.email}</span>
                        <span className={`text-xs ${tc.textMuted}`}>{user.phone || " "}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.status === "Active" ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">Actif</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">Suspendu</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => toggleAvailability(user.id, user.is_available)}
                      title={user.is_available ? "Cliquer pour mettre hors ligne" : "Cliquer pour mettre disponible"}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                        user.is_available
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                          : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {user.is_available ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                      {user.is_available ? "Disponible" : "Hors ligne"}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={user.role === 'admin' ? (light ? 'bg-brand-100 text-brand-700' : 'bg-brand-500/10 text-brand-400') : (light ? 'bg-slate-100 text-slate-700' : '')}>
                      {user.role.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-center font-mono ${tc.text}`}>{user.ordersHandled}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[180px]">
                        <DropdownMenuItem className="cursor-pointer text-amber-500 focus:text-amber-500" onClick={() => toggleSuspend(user.id)}>
                          <Ban className="mr-2 h-4 w-4" />
                          {user.status === "Active" ? "Suspendre l'acces" : "Activer l'acces"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer text-red-500 focus:text-red-500"
                          onClick={() => handleRevoke(user.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Revoquer l'acces
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SLIDE OUT PANEL FOR USER DETAILS */}
      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent className={`w-[400px] sm:w-[540px] overflow-y-auto ${tc.modal}`}>
          <SheetHeader>
            <SheetTitle className={`${tc.text}`}>Détails du personnel</SheetTitle>
            <SheetDescription className={`${tc.textMuted}`}>{selectedUser?.name} ({selectedUser?.email})</SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="general" className="mt-6 space-y-4">
            <TabsList className={`grid grid-cols-3 border ${tc.modal}`}>
              <TabsTrigger value="general">Modifier</TabsTrigger>
              <TabsTrigger value="active">Tâches actives</TabsTrigger>
              <TabsTrigger value="history">Historique</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="space-y-4">
              {/* Availability + status quick row */}
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={selectedUser?.status === "Active" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"}>
                  {selectedUser?.status || "Inconnu"}
                </Badge>
                {selectedUser && (
                  <button
                    onClick={() => { toggleAvailability(selectedUser.id, selectedUser.is_available); setSelectedUser({ ...selectedUser, is_available: !selectedUser.is_available }) }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      selectedUser.is_available
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                        : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {selectedUser.is_available ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {selectedUser.is_available ? "Disponible — cliquer pour mettre hors ligne" : "Hors ligne — cliquer pour mettre disponible"}
                  </button>
                )}
              </div>

              {/* Editable form */}
              <form onSubmit={handleEditMember} className="space-y-3">
                <div className="space-y-1">
                  <label className={`text-xs font-medium ${tc.textMuted}`}>Nom complet</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} className={`flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors ${tc.input}`} placeholder="Nom complet" />
                </div>
                <div className="space-y-1">
                  <label className={`text-xs font-medium ${tc.textMuted}`}>E-mail</label>
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className={`flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors ${tc.input}`} placeholder="Adresse e-mail" />
                </div>
                <div className="space-y-1">
                  <label className={`text-xs font-medium ${tc.textMuted}`}>Téléphone</label>
                  <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} className={`flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors ${tc.input}`} placeholder="+212..." />
                </div>
                <div className="space-y-1">
                  <label className={`text-xs font-medium ${tc.textMuted}`}>Rôle</label>
                  <select value={editRole} onChange={e => setEditRole(e.target.value)} className={`flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors ${tc.select}`}>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <Button type="submit" disabled={isEditSubmitting} className="w-full bg-brand-600 hover:bg-brand-700">
                  {isEditSubmitting ? "Enregistrement…" : "Enregistrer les modifications"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="active" className="space-y-3">
              {userOrders.current_orders.length === 0 ? (
                <div className={`rounded-lg border border-dashed p-4 text-sm ${tc.card}`}>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-500/10 flex items-center justify-center text-slate-500">
                      <Inbox className="h-5 w-5" />
                    </div>
                    <div>
                      <p className={`font-semibold ${tc.text}`}>Aucune commande active</p>
                      <p className={`text-xs ${tc.textMuted}`}>Ce membre du personnel n'a aucune tâche en cours.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {userOrders.current_orders.map((o: any) => (
                    <li key={o.id} className={`text-sm p-3 border rounded-md flex justify-between ${tc.card}`}>
                      <span className={`${tc.text}`}>{o.youcan_ref || o.id}</span>
                      <Badge variant="outline">{o.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="history" className="space-y-3">
              {userOrders.past_orders.length === 0 ? (
                <div className={`rounded-lg border border-dashed p-4 text-sm ${tc.card}`}>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-500/10 flex items-center justify-center text-slate-500">
                      <Inbox className="h-5 w-5" />
                    </div>
                    <div>
                      <p className={`font-semibold ${tc.text}`}>Aucun historique</p>
                      <p className={`text-xs ${tc.textMuted}`}>Les commandes terminées apparaîtront ici une fois traitées.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {userOrders.past_orders.slice(0, 10).map((o: any) => (
                    <li key={o.id} className={`text-sm p-3 border rounded-md flex justify-between ${tc.card}`}>
                      <span className={`${tc.textMuted}`}>{o.youcan_ref || o.id}</span>
                      <Badge variant="secondary">{o.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* ADD MEMBER MODAL */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className={`sm:max-w-[425px] ${tc.modal}`}>
          <DialogHeader>
            <DialogTitle className={`${tc.text}`}>Provisionner l'accès</DialogTitle>
            <DialogDescription className={`${tc.textMuted}`}>
              Autoriser un nouveau membre du personnel ou administrateur. Ils obtiendront un accès immédiat via Google OAuth.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className={`text-sm font-medium ${tc.text}`}>Nom complet</label>
              <input required value={newName} onChange={e => setNewName(e.target.value)} className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors ${tc.input}`} placeholder="ex. Jane Doe" />
            </div>
            <div className="space-y-2">
              <label className={`text-sm font-medium ${tc.text}`}>Adresse e-mail</label>
              <input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors ${tc.input}`} placeholder="ex. jane@chridirect.store" />
            </div>
            <div className="space-y-2">
              <label className={`text-sm font-medium ${tc.text}`}>Numéro de téléphone</label>
              <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors ${tc.input}`} placeholder="e.g. +212612345678" />
            </div>
            <div className="space-y-2">
              <label className={`text-sm font-medium ${tc.text}`}>Rôle système</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value)} className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors ${tc.select}`}>
                <option value="staff">Membre Staff</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            <div className="pt-2">
              <Button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white transition-colors" disabled={isSubmitting}>
                {isSubmitting ? "Traitement…" : "Autoriser l'accès"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className={`fixed inset-x-0 bottom-0 z-50 px-6 pb-6 transition-all duration-200 ease-in-out ${hasSelection ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0 pointer-events-none"}`}>
        <div className={`mx-auto flex max-w-4xl items-center justify-between rounded-2xl border px-4 py-3 shadow-lg ${tc.card}`}>
          <div className={`text-sm ${tc.textMuted}`}>
            <span className={`font-semibold ${tc.text}`}>{selectedUsers.length}</span> sélectionné(s)
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={selectedActiveIds.length === 0}
              onClick={() => bulkSuspendToggle(selectedActiveIds)}
              className="text-amber-300 border-amber-400/30 hover:bg-amber-500/10 transition-colors"
            >
              Suspendre
            </Button>
            <Button
              variant="outline"
              disabled={selectedSuspendedIds.length === 0}
              onClick={() => bulkSuspendToggle(selectedSuspendedIds)}
              className="text-emerald-300 border-emerald-400/30 hover:bg-emerald-500/10 transition-colors"
            >
              Restaurer
            </Button>
            <Button
              variant="outline"
              disabled={!hasSelection}
              onClick={() => bulkRevoke(selectedUsers.map((user) => user.id))}
              className="text-red-300 border-red-400/30 hover:bg-red-500/10 transition-colors"
            >
              Révoquer
            </Button>
          </div>
        </div>
      </div>

    </div>
  )
}
