import { useState, useEffect } from 'react';
import {
  Box, Button, Card, Typography, Grid, Chip, Tooltip, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  MenuItem, Select, FormControl, InputLabel, Avatar, CircularProgress
} from '@mui/material';
import {
  Refresh, CheckCircle, Cancel, Schedule, AccessTime, QrCodeScanner, People, HowToReg
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { attendanceAPI, dashboardAPI } from '../../services/api';
import toast from 'react-hot-toast';

const statusColors = {
  Present: '#10b981',
  present: '#10b981',
  Absent: '#ef4444',
  absent: '#ef4444',
  Late: '#f59e0b',
  late: '#f59e0b',
  'Half Day': '#f97316',
  half_day: '#f97316',
};

export default function AdminAttendance() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0 });

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const [recRes, dashRes] = await Promise.all([
        attendanceAPI.list({ month, year }),
        dashboardAPI.admin().catch(() => ({ data: {} }))
      ]);
      setRecords(recRes.data.results || recRes.data);
      setStats({
        total: dashRes.data.total_employees || 0,
        present: dashRes.data.present_today || 0,
        absent: (dashRes.data.total_employees || 0) - (dashRes.data.present_today || 0),
      });
    } catch {
      toast.error('Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, [month, year]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Summary from records
  const summary = records.reduce((acc, r) => {
    const key = (r.attendance_status || '').toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <Layout>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Attendance</Typography>
          <Typography variant="body2" color="text.secondary">Track daily attendance with permanent employee QR codes</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchRecords} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button
            id="go-to-scanner-btn"
            variant="contained"
            startIcon={<QrCodeScanner />}
            onClick={() => navigate('/admin/scanner')}
            sx={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              boxShadow: '0 4px 15px rgba(99,102,241,0.4)',
              '&:hover': { background: 'linear-gradient(135deg, #818cf8, #6366f1)' },
            }}
          >
            Open QR Scanner
          </Button>
        </Box>
      </Box>

      {/* Today's live stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Employees', count: stats.total, color: '#6366f1', icon: <People /> },
          { label: 'Present Today', count: stats.present, color: '#10b981', icon: <HowToReg /> },
          { label: 'Present (Month)', count: summary.present || 0, color: '#10b981', icon: <CheckCircle /> },
          { label: 'Absent (Month)', count: summary.absent || 0, color: '#ef4444', icon: <Cancel /> },
          { label: 'Late (Month)', count: summary.late || 0, color: '#f59e0b', icon: <Schedule /> },
          { label: 'Half Day (Month)', count: summary.half_day || 0, color: '#f97316', icon: <AccessTime /> },
        ].map((item) => (
          <Grid item xs={6} sm={4} md={2} key={item.label}>
            <Card sx={{
              position: 'relative', overflow: 'hidden',
              '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: item.color },
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-2px)' }
            }}>
              <Box sx={{ p: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: item.color, lineHeight: 1.2 }}>{item.count}</Typography>
                  </Box>
                  <Box sx={{ color: item.color, opacity: 0.5, mt: 0.5 }}>{item.icon}</Box>
                </Box>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Month</InputLabel>
          <Select id="att-month" value={month} label="Month" onChange={(e) => setMonth(e.target.value)}>
            {months.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Year</InputLabel>
          <Select id="att-year" value={year} label="Year" onChange={(e) => setYear(e.target.value)}>
            {[2024, 2025, 2026, 2027].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary">
          Showing {records.length} records for {months[month - 1]} {year}
        </Typography>
      </Box>

      {/* Attendance Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ '& th': { borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 700, color: 'text.secondary', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 } }}>
                <TableCell>Employee</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="center">Check In</TableCell>
                <TableCell align="center">Check Out</TableCell>
                <TableCell align="center">Hours</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <QrCodeScanner sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3, mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography color="text.secondary">No attendance records for {months[month - 1]} {year}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Use the QR Scanner to mark employee attendance
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Button variant="outlined" startIcon={<QrCodeScanner />} onClick={() => navigate('/admin/scanner')}>
                        Go to QR Scanner
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((rec) => (
                  <TableRow key={rec.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.dark', fontSize: 13, fontWeight: 700 }}>
                          {rec.employee_name?.[0] || '?'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{rec.employee_name}</Typography>
                          <Typography variant="caption" color="primary.main">{rec.employee_code}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="body2">{rec.attendance_date}</Typography></TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" fontWeight={rec.check_in_time ? 600 : 400} color={rec.check_in_time ? '#10b981' : 'text.secondary'}>
                        {rec.check_in_time || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" fontWeight={rec.check_out_time ? 600 : 400} color={rec.check_out_time ? '#6366f1' : 'text.secondary'}>
                        {rec.check_out_time || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {rec.working_hours ? `${parseFloat(rec.working_hours).toFixed(1)}h` : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={(rec.attendance_status || '').replace('_', ' ')}
                        size="small"
                        sx={{
                          bgcolor: `${statusColors[rec.attendance_status] || '#6366f1'}20`,
                          color: statusColors[rec.attendance_status] || '#6366f1',
                          fontWeight: 600, textTransform: 'capitalize',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Layout>
  );
}
