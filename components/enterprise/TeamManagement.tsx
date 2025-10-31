'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface TeamMember {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
  permissions: Permission[]
  status: 'active' | 'pending' | 'suspended'
  lastActive?: string
  joinedAt: string
  invitedBy: string
  departments: string[]
  accessLevel: 'full' | 'limited' | 'restricted'
}

export interface Permission {
  id: string
  name: string
  description: string
  category: 'dashboard' | 'directories' | 'analytics' | 'settings' | 'billing' | 'team'
  level: 'read' | 'write' | 'admin'
}

export interface TeamInvitation {
  id: string
  email: string
  role: TeamMember['role']
  permissions: Permission[]
  invitedBy: string
  invitedAt: string
  expiresAt: string
  message?: string
}

const AVAILABLE_PERMISSIONS: Permission[] = [
  // Dashboard
  { id: 'dashboard_view', name: 'View Dashboard', description: 'Access main dashboard', category: 'dashboard', level: 'read' },
  { id: 'dashboard_customize', name: 'Customize Dashboard', description: 'Modify dashboard layout and widgets', category: 'dashboard', level: 'write' },
  
  // Directories
  { id: 'directories_view', name: 'View Directories', description: 'See directory submissions and status', category: 'directories', level: 'read' },
  { id: 'directories_submit', name: 'Submit Directories', description: 'Create new directory submissions', category: 'directories', level: 'write' },
  { id: 'directories_manage', name: 'Manage Directories', description: 'Edit and delete directory submissions', category: 'directories', level: 'admin' },
  
  // Analytics
  { id: 'analytics_view', name: 'View Analytics', description: 'Access analytics and reports', category: 'analytics', level: 'read' },
  { id: 'analytics_export', name: 'Export Analytics', description: 'Download reports and data', category: 'analytics', level: 'write' },
  { id: 'analytics_configure', name: 'Configure Analytics', description: 'Set up custom tracking and reports', category: 'analytics', level: 'admin' },
  
  // Settings
  { id: 'settings_view', name: 'View Settings', description: 'Access organization settings', category: 'settings', level: 'read' },
  { id: 'settings_edit', name: 'Edit Settings', description: 'Modify organization settings', category: 'settings', level: 'write' },
  { id: 'settings_admin', name: 'Admin Settings', description: 'Access advanced settings and integrations', category: 'settings', level: 'admin' },
  
  // Billing
  { id: 'billing_view', name: 'View Billing', description: 'See billing information and usage', category: 'billing', level: 'read' },
  { id: 'billing_manage', name: 'Manage Billing', description: 'Update payment methods and plans', category: 'billing', level: 'admin' },
  
  // Team
  { id: 'team_view', name: 'View Team', description: 'See team members and their roles', category: 'team', level: 'read' },
  { id: 'team_invite', name: 'Invite Members', description: 'Send team invitations', category: 'team', level: 'write' },
  { id: 'team_manage', name: 'Manage Team', description: 'Edit roles and remove members', category: 'team', level: 'admin' }
]

const ROLE_TEMPLATES: Record<TeamMember['role'], Permission[]> = {
  owner: AVAILABLE_PERMISSIONS, // All permissions
  admin: AVAILABLE_PERMISSIONS.filter(p => p.level !== 'admin' || p.category !== 'billing'),
  manager: AVAILABLE_PERMISSIONS.filter(p => 
    ['dashboard', 'directories', 'analytics'].includes(p.category) && p.level !== 'admin'
  ),
  member: AVAILABLE_PERMISSIONS.filter(p => 
    ['dashboard', 'directories'].includes(p.category) && p.level === 'read'
  ),
  viewer: AVAILABLE_PERMISSIONS.filter(p => p.level === 'read')
}

interface TeamManagementProps {
  organizationId: string
  currentUserId: string
  userRole: TeamMember['role']
  className?: string
}

export default function TeamManagement({
  organizationId,
  currentUserId,
  userRole,
  className = ''
}: TeamManagementProps) {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<TeamInvitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [filter, setFilter] = useState<'all' | TeamMember['status']>('all')

  const canManageTeam = ['owner', 'admin'].includes(userRole)
  const canInviteMembers = ['owner', 'admin', 'manager'].includes(userRole)

  useEffect(() => {
    loadTeamData()
  }, [organizationId])

  const loadTeamData = async () => {
    setIsLoading(true)
    try {
      const [teamResponse, invitesResponse] = await Promise.all([
        fetch(`/api/enterprise/team?organizationId=${organizationId}`),
        fetch(`/api/enterprise/team/invitations?organizationId=${organizationId}`)
      ])

      if (teamResponse.ok) {
        const { team: teamData } = await teamResponse.json()
        setTeam(teamData || [])
      }

      if (invitesResponse.ok) {
        const { invitations: inviteData } = await invitesResponse.json()
        setInvitations(inviteData || [])
      }
    } catch (error) {
      console.error('Failed to load team data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInviteMember = async (invitation: Omit<TeamInvitation, 'id' | 'invitedBy' | 'invitedAt' | 'expiresAt'>) => {
    try {
      const response = await fetch('/api/enterprise/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          ...invitation,
          invitedBy: currentUserId
        })
      })

      if (response.ok) {
        loadTeamData()
        setShowInviteModal(false)
      }
    } catch (error) {
      console.error('Failed to invite member:', error)
    }
  }

  const handleUpdateMember = async (memberId: string, updates: Partial<TeamMember>) => {
    try {
      const response = await fetch('/api/enterprise/team/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          memberId,
          updates
        })
      })

      if (response.ok) {
        setTeam(prev => prev.map(member => 
          member.id === memberId ? { ...member, ...updates } : member
        ))
      }
    } catch (error) {
      console.error('Failed to update member:', error)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return

    try {
      const response = await fetch('/api/enterprise/team/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          memberId
        })
      })

      if (response.ok) {
        setTeam(prev => prev.filter(member => member.id !== memberId))
      }
    } catch (error) {
      console.error('Failed to remove member:', error)
    }
  }

  const getRoleColor = (role: TeamMember['role']) => {
    const colors = {
      owner: 'text-purple-400 bg-purple-500/20',
      admin: 'text-red-400 bg-red-500/20',
      manager: 'text-blue-400 bg-blue-500/20',
      member: 'text-green-400 bg-green-500/20',
      viewer: 'text-gray-400 bg-gray-500/20'
    }
    return colors[role] || colors.viewer
  }

  const getStatusColor = (status: TeamMember['status']) => {
    const colors = {
      active: 'text-green-400',
      pending: 'text-volt-400',
      suspended: 'text-red-400'
    }
    return colors[status] || colors.active
  }

  const filteredTeam = team.filter(member => {
    if (filter === 'all') return true
    return member.status === filter
  })

  if (isLoading) {
    return (
      <div className={`${className} space-y-4`}>
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-secondary-800 rounded-lg h-20" />
        ))}
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            👥 Team Management
          </h2>
          <p className="text-secondary-400">
            Manage team members, roles, and permissions
          </p>
        </div>

        {canInviteMembers && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-volt-500 hover:bg-volt-400 text-secondary-900 rounded-lg font-medium transition-colors"
          >
            + Invite Member
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-secondary-800 rounded-lg p-4 border border-secondary-700">
          <div className="text-2xl font-bold text-white">{team.length}</div>
          <div className="text-sm text-secondary-400">Total Members</div>
        </div>
        <div className="bg-secondary-800 rounded-lg p-4 border border-secondary-700">
          <div className="text-2xl font-bold text-green-400">
            {team.filter(m => m.status === 'active').length}
          </div>
          <div className="text-sm text-secondary-400">Active</div>
        </div>
        <div className="bg-secondary-800 rounded-lg p-4 border border-secondary-700">
          <div className="text-2xl font-bold text-volt-400">
            {invitations.length}
          </div>
          <div className="text-sm text-secondary-400">Pending Invites</div>
        </div>
        <div className="bg-secondary-800 rounded-lg p-4 border border-secondary-700">
          <div className="text-2xl font-bold text-blue-400">
            {team.filter(m => ['admin', 'manager'].includes(m.role)).length}
          </div>
          <div className="text-sm text-secondary-400">Admins & Managers</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-2">
          {['all', 'active', 'pending', 'suspended'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                filter === status
                  ? 'bg-volt-500/20 text-volt-400'
                  : 'text-secondary-400 hover:text-secondary-300 hover:bg-secondary-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Team List */}
      <div className="bg-secondary-800 rounded-xl border border-secondary-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Team Members</h3>
          
          <div className="space-y-4">
            {filteredTeam.map(member => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 bg-secondary-700/50 rounded-lg hover:bg-secondary-700 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-volt-500/20 rounded-full flex items-center justify-center">
                    <span className="text-volt-400 font-semibold">
                      {member.firstName[0]}{member.lastName[0]}
                    </span>
                  </div>
                  
                  <div>
                    <div className="font-medium text-white">
                      {member.firstName} {member.lastName}
                    </div>
                    <div className="text-sm text-secondary-400">{member.email}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleColor(member.role)}`}>
                        {member.role}
                      </span>
                      <span className={`text-xs ${getStatusColor(member.status)}`}>
                        {member.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-sm text-secondary-400">
                      {member.lastActive ? `Active ${new Date(member.lastActive).toLocaleDateString()}` : 'Never'}
                    </div>
                    <div className="text-xs text-secondary-500">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </div>
                  </div>

                  {canManageTeam && member.id !== currentUserId && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedMember(member)}
                        className="p-2 text-secondary-400 hover:text-white transition-colors"
                        title="Edit Member"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-2 text-secondary-400 hover:text-red-400 transition-colors"
                        title="Remove Member"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredTeam.length === 0 && (
              <div className="text-center py-8">
                <span className="text-4xl mb-4 block">👤</span>
                <h3 className="text-lg font-semibold text-white mb-2">No team members found</h3>
                <p className="text-secondary-400">
                  {filter === 'all' ? 'Start by inviting your first team member' : `No ${filter} members`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="border-t border-secondary-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Pending Invitations</h3>
            <div className="space-y-3">
              {invitations.map(invitation => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 bg-volt-500/10 border border-volt-500/30 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-white">{invitation.email}</div>
                    <div className="text-sm text-secondary-400">
                      Invited as {invitation.role} • Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  
                  {canManageTeam && (
                    <button
                      onClick={() => {
                        // Handle resend invitation
                        console.log('Resend invitation:', invitation.id)
                      }}
                      className="text-volt-400 hover:text-volt-300 text-sm"
                    >
                      Resend
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <InviteMemberModal
            onInvite={handleInviteMember}
            onClose={() => setShowInviteModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Edit Member Modal */}
      <AnimatePresence>
        {selectedMember && (
          <EditMemberModal
            member={selectedMember}
            onUpdate={(updates) => {
              handleUpdateMember(selectedMember.id, updates)
              setSelectedMember(null)
            }}
            onClose={() => setSelectedMember(null)}
            canEdit={canManageTeam}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Invite Member Modal Component
function InviteMemberModal({
  onInvite,
  onClose
}: {
  onInvite: (invitation: Omit<TeamInvitation, 'id' | 'invitedBy' | 'invitedAt' | 'expiresAt'>) => void
  onClose: () => void
}) {
  const [formData, setFormData] = useState({
    email: '',
    role: 'member' as TeamMember['role'],
    permissions: [] as Permission[],
    message: ''
  })

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      permissions: ROLE_TEMPLATES[prev.role] || []
    }))
  }, [formData.role])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onInvite(formData)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-secondary-800 rounded-xl border border-secondary-700 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-secondary-700">
          <h3 className="text-lg font-bold text-white">Invite Team Member</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white"
              placeholder="colleague@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as TeamMember['role'] })}
              className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white"
            >
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Personal Message (Optional)</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white"
              placeholder="Welcome to our team..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-secondary-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-volt-500 hover:bg-volt-400 text-secondary-900 rounded-lg font-medium transition-colors"
            >
              Send Invitation
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// Edit Member Modal Component
function EditMemberModal({
  member,
  onUpdate,
  onClose,
  canEdit
}: {
  member: TeamMember
  onUpdate: (updates: Partial<TeamMember>) => void
  onClose: () => void
  canEdit: boolean
}) {
  const [formData, setFormData] = useState({
    role: member.role,
    status: member.status,
    permissions: member.permissions,
    departments: member.departments
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdate(formData)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-secondary-800 rounded-xl border border-secondary-700 max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-secondary-700">
          <h3 className="text-lg font-bold text-white">
            Edit {member.firstName} {member.lastName}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as TeamMember['role'] })}
              disabled={!canEdit}
              className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white disabled:opacity-50"
            >
              <option value="viewer">Viewer</option>
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as TeamMember['status'] })}
              disabled={!canEdit}
              className="w-full px-3 py-2 bg-secondary-700 border border-secondary-600 rounded-lg text-white disabled:opacity-50"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-secondary-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            {canEdit && (
              <button
                type="submit"
                className="px-4 py-2 bg-volt-500 hover:bg-volt-400 text-secondary-900 rounded-lg font-medium transition-colors"
              >
                Save Changes
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}