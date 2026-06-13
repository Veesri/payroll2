import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Chip, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid,
  Select, FormControl, InputLabel, MenuItem, Slider, Switch, FormControlLabel
} from '@mui/material';
import { Add, Edit, Close as CloseIcon, Refresh } from '@mui/icons-material';
import Layout from '../../components/Layout';
import { salaryRulesAPI } from '../../services/api';
import toast from 'react-hot-toast';

const defaultForm = {
  group_name: '', basic_salary_min: 0, basic_salary_max: 1000000,
  hra_pct: 40, da_pct: 20, medical_pct: 5, travel_pct: 5,
  pf_pct: 12, esi_pct: 0.75, pt_amount: 200, is_active: true,
};

export default function AdminSalaryRules() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await salaryRulesAPI.list();
      setGroups(res.data.results || res.data);
    } catch { toast.error('Failed to load salary rules'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGroups(); }, []);

  const openCreate = () => { setForm(defaultForm); setEditId(null); setDialogOpen(true); };
  const openEdit = (g) => {
    setForm({ group_name: g.group_name, basic_salary_min: g.basic_salary_min, basic_salary_max: g.basic_salary_max, hra_pct: g.hra_pct, da_pct: g.da_pct, medical_pct: g.medical_pct, travel_pct: g.travel_pct, pf_pct: g.pf_pct, esi_pct: g.esi_pct, pt_amount: g.pt_amount, is_active: g.is_active });
    setEditId(g.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.group_name.trim()) { toast.error('Group name required'); return; }
    setSaving(true);
    try {
      if (editId) { await salaryRulesAPI.update(editId, form); toast.success('Rule updated!'); }
      else { await salaryRulesAPI.create(form); toast.success('Rule created!'); }
      setDialogOpen(false);
      fetchGroups();
    } catch (err) { toast.error(err.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <Layout>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Salary Rules</Typography>
          <Typography variant="body2" color="text.secondary">Configure allowances and deduction percentages</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh"><IconButton onClick={fetchGroups} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}><Refresh /></IconButton></Tooltip>
          <Button id="add-salary-rule-btn" variant="contained" startIcon={<Add />} onClick={openCreate}
            sx={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 15px rgba(99,102,241,0.4)' }}>
            Add Rule Group
          </Button>
        </Box>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ '& th': { borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 700, color: 'text.secondary', fontSize: 12, textTransform: 'uppercase' } }}>
                <TableCell>Group Name</TableCell>
                <TableCell align="right">HRA %</TableCell>
                <TableCell align="right">DA %</TableCell>
                <TableCell align="right">PF %</TableCell>
                <TableCell align="right">ESI %</TableCell>
                <TableCell align="right">PT ₹</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>Loading...</TableCell></TableRow>
              ) : groups.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No salary rules configured yet</TableCell></TableRow>
              ) : (
                groups.map((g) => (
                  <TableRow key={g.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                    <TableCell><Typography variant="body2" fontWeight={600}>{g.group_name}</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2">{g.hra_pct}%</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2">{g.da_pct}%</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2">{g.pf_pct}%</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2">{g.esi_pct}%</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2">₹{g.pt_amount}</Typography></TableCell>
                    <TableCell align="center">
                      <Chip label={g.is_active ? 'Active' : 'Inactive'} size="small"
                        sx={{ bgcolor: g.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)', color: g.is_active ? '#10b981' : '#ef4444', fontWeight: 600 }} />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit">
                        <IconButton id={`edit-rule-${g.id}`} size="small" onClick={() => openEdit(g)} sx={{ color: 'primary.main' }}><Edit fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: 'background.paper', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography fontWeight={700}>{editId ? 'Edit Rule Group' : 'Create Rule Group'}</Typography>
          <IconButton onClick={() => setDialogOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField id="rule-name" label="Group Name" fullWidth required value={form.group_name}
            onChange={(e) => set('group_name', e.target.value)} inputProps={{ maxLength: 100 }} sx={{ mb: 2, mt: 1 }} />
          <Typography variant="overline" color="text.secondary">Allowances</Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}><TextField label="HRA %" type="number" fullWidth value={form.hra_pct} onChange={(e) => set('hra_pct', e.target.value)} inputProps={{ min: 0, max: 100, step: 1 }} /></Grid>
            <Grid item xs={6}><TextField label="DA %" type="number" fullWidth value={form.da_pct} onChange={(e) => set('da_pct', e.target.value)} inputProps={{ min: 0, max: 100, step: 1 }} /></Grid>
            <Grid item xs={6}><TextField label="Medical %" type="number" fullWidth value={form.medical_pct} onChange={(e) => set('medical_pct', e.target.value)} inputProps={{ min: 0, max: 100, step: 1 }} /></Grid>
            <Grid item xs={6}><TextField label="Travel %" type="number" fullWidth value={form.travel_pct} onChange={(e) => set('travel_pct', e.target.value)} inputProps={{ min: 0, max: 100, step: 1 }} /></Grid>
          </Grid>
          <Typography variant="overline" color="text.secondary">Deductions</Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={4}><TextField label="PF %" type="number" fullWidth value={form.pf_pct} onChange={(e) => set('pf_pct', e.target.value)} inputProps={{ min: 0, max: 20, step: 0.5 }} /></Grid>
            <Grid item xs={4}><TextField label="ESI %" type="number" fullWidth value={form.esi_pct} onChange={(e) => set('esi_pct', e.target.value)} inputProps={{ min: 0, max: 5, step: 0.25 }} /></Grid>
            <Grid item xs={4}><TextField label="PT ₹" type="number" fullWidth value={form.pt_amount} onChange={(e) => set('pt_amount', e.target.value)} inputProps={{ min: 0, max: 2500, step: 50 }} /></Grid>
          </Grid>
          <FormControlLabel control={<Switch checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} color="primary" />} label="Active" />
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button id="save-rule-btn" variant="contained" onClick={handleSave} disabled={saving}
            sx={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
            {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
