import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, CartesianGrid, Tooltip, Area, AreaChart, XAxis, YAxis
} from 'recharts';
import { Play, Activity, History, Zap, TrendingUp, Shield, AlertCircle, CheckCircle, Clock, ChevronRight, RefreshCw, Download, Trash2 } from 'lucide-react';
import './styles/App.css';

const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:8000/api`;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p style={{ color: '#888899', marginBottom: 4 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: <strong>{(p.value * 100).toFixed(0)}%</strong></p>
        ))}
      </div>
    );
  }
  return null;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [model, setModel] = useState('');
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking'); // 'ok', 'error', 'checking'
  const [selectedEvaluationId, setSelectedEvaluationId] = useState(null);

  useEffect(() => { 
    checkHealth();
    fetchEvaluations(); 
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (alert) {
      const t = setTimeout(() => setAlert(null), 3500);
      return () => clearTimeout(t);
    }
  }, [alert]);

  const checkHealth = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/health/`);
      if (res.data.status === 'ok') {
        setApiStatus('ok');
      } else {
        setApiStatus('error');
        showAlert(`Atenção: ${res.data.message}`, 'error');
      }
    } catch (err) {
      setApiStatus('error');
      const detail = err.response?.data?.message || err.message;
      showAlert(`Erro de Conexão: ${detail}`, 'error');
    }
  };

  const fetchEvaluations = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/evaluate/`);
      setEvaluations(res.data);
    } catch (err) {
      setApiStatus('error');
      showAlert('Erro ao conectar com a API backend. Verifique se o servidor está rodando.', 'error');
    }
  };

  const showAlert = (msg, type = 'success') => setAlert({ msg, type });

  const handleRunTest = async () => {
    if (apiStatus !== 'ok') {
      showAlert('A API está offline. Verifique a conexão antes de iniciar uma avaliação.', 'error');
      return;
    }
    if (!prompt || !output) { showAlert('Preencha os dois campos antes de avaliar.', 'error'); return; }
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/evaluate/`, { 
        input: prompt, 
        output,
        model: model || null,
        reliability_runs: 1 
      }, {
        timeout: 300000 // 5 minutos
      });
      showAlert('Avaliação concluída com sucesso!');
      setPrompt(''); setOutput(''); setModel('');
      fetchEvaluations();
      setActiveTab('dashboard');
    } catch (err) {
      let errorMsg = 'Erro na avaliação';
      if (err.code === 'ECONNABORTED') {
        errorMsg = 'Tempo esgotado (Timeout). A avaliação do Gemini está demorando mais que o esperado.';
      } else if (err.response) {
        errorMsg = `Erro ${err.response.status}: ${err.response.data?.detail || 'Erro no servidor'}`;
      } else if (err.request) {
        errorMsg = 'Sem resposta do servidor. Verifique se o backend está rodando.';
        setApiStatus('error');
      } else {
        errorMsg = err.message;
      }
      showAlert(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/export-csv/`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio_eval_${new Date().getTime()}.csv`);
      document.body.appendChild(link);
      link.click();
      showAlert('CSV exportado com sucesso!');
    } catch (err) {
      showAlert('Erro ao exportar CSV', 'error');
    }
  };

  const handleDeleteEvaluation = async (evaluationId) => {
    if (!window.confirm('Tem certeza que deseja deletar esta avaliação? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    try {
      await axios.delete(`${API_BASE_URL}/evaluate/${evaluationId}`);
      showAlert('Avaliação deletada com sucesso!');
      fetchEvaluations();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Erro ao deletar avaliação';
      showAlert(errorMsg, 'error');
    }
  };

  const getRadarData = () => {
    if (!evaluations.length) return [];
    const l = evaluations[0];
    return [
      { subject: 'Neutralidade', A: l.neutrality_score ?? 0 },
      { subject: 'Viés Eleitoral', A: l.electoral_bias_score ?? 0 },
      { subject: 'Não-Alucinação', A: l.hallucination_score ?? 0 },
      { subject: 'Estabilidade', A: (
        (l.neutrality_is_stable ? 1 : 0) + 
        (l.electoral_bias_is_stable ? 1 : 0) + 
        (l.hallucination_is_stable ? 1 : 0)
      ) / 3 },
      { subject: 'Integridade Geral', A: l.composite_risk_score ?? 0 },
    ];
  };

  const getTrendData = () =>
    [...evaluations].reverse().slice(-8).map((ev, i) => ({
      n: i + 1,
      neutralidade: ev.neutrality_score ?? 0,
      vies: ev.electoral_bias_score ?? 0,
      alucinacao: ev.hallucination_score ?? 0,
      integridade: ev.composite_risk_score ?? 0,
    }));

  const avgNeutrality = evaluations.length
    ? (evaluations.reduce((s, e) => s + (e.neutrality_score ?? 0), 0) / evaluations.length).toFixed(2)
    : '—';

  const avgElectoralBias = evaluations.length
    ? (evaluations.reduce((s, e) => s + (e.electoral_bias_score ?? 0), 0) / evaluations.length).toFixed(2)
    : '—';

  const avgHallucination = evaluations.length
    ? (evaluations.reduce((s, e) => s + (e.hallucination_score ?? 0), 0) / evaluations.length).toFixed(2)
    : '—';

  const avgRisk = evaluations.length
    ? (evaluations.reduce((s, e) => s + (e.composite_risk_score ?? 0), 0) / evaluations.length).toFixed(2)
    : '—';

  const latestScore = evaluations[0]?.composite_risk_score ?? null;

  const getScoreClass = (v) => v > 0.7 ? 'score-high' : v > 0.4 ? 'score-mid' : 'score-low';
  const getBadgeClass = (v) => v > 0.7 ? 'badge-green' : v > 0.4 ? 'badge-amber' : 'badge-red';
  const getRiskBadgeClass = (v) => v < 0.3 ? 'badge-green' : v < 0.6 ? 'badge-amber' : 'badge-red';

  const getSelectedEvaluation = () => evaluations.find(e => e.id === selectedEvaluationId);

  const getDetailRadarData = () => {
    const ev = getSelectedEvaluation();
    if (!ev) return [];
    return [
      { subject: 'Neutralidade', A: ev.neutrality_score ?? 0 },
      { subject: 'Viés Eleitoral', A: ev.electoral_bias_score ?? 0 },
      { subject: 'Não-Alucinação', A: ev.hallucination_score ?? 0 },
      { subject: 'Estabilidade', A: (
        (ev.neutrality_is_stable ? 1 : 0) + 
        (ev.electoral_bias_is_stable ? 1 : 0) + 
        (ev.hallucination_is_stable ? 1 : 0)
      ) / 3 },
      { subject: 'Integridade Geral', A: ev.composite_risk_score ?? 0 },
    ];
  };

  const handleSelectEvaluation = (evaluationId) => {
    setSelectedEvaluationId(evaluationId);
    setActiveTab('detail');
  };

  return (
    <div className="app-container">
      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {alert.msg}
        </div>
      )}

      <div className="app">
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-text">VIG<span>IA</span></div>
          </div>
          <nav className="nav">
            {[
              { id: 'dashboard', icon: <Activity size={17} />, label: 'Dashboard' },
              { id: 'run', icon: <Zap size={17} />, label: 'Nova Avaliação' },
              { id: 'history', icon: <History size={17} />, label: 'Histórico' },
            ].map(item => (
              <div
                key={item.id}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.icon}
                {item.label}
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <span className={`status-dot dot-${apiStatus}`}></span>
            {apiStatus === 'ok' ? 'API Conectada' : apiStatus === 'checking' ? 'Verificando...' : 'API Desconectada'}
            {apiStatus === 'error' && (
              <button 
                onClick={() => { setApiStatus('checking'); checkHealth(); fetchEvaluations(); }} 
                className="retry-btn-small"
              >
                Tentar reconectar
              </button>
            )}
            <div style={{ marginTop: 6, color: '#2a2a3a' }}>Gemini · v2.0</div>
          </div>
        </aside>

        <main className="main">
          {activeTab === 'dashboard' && (
            <div>
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1>Dashboard de Integridade</h1>
                  <p>Monitoramento em tempo real das avaliações de IA</p>
                </div>
                {evaluations.length > 0 && (
                  <button className="export-btn" onClick={handleExportCSV}>
                    <Download size={15} /> Exportar CSV
                  </button>
                )}
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label"><TrendingUp size={13} /> Total</div>
                  <div className="stat-value">{evaluations.length}</div>
                  <div className="stat-sub">avaliações realizadas</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label"><Shield size={13} /> Neutralidade</div>
                  <div className="stat-value" style={{ fontSize: 26 }}>{avgNeutrality !== '—' ? `${(avgNeutrality * 100).toFixed(0)}%` : '—'}</div>
                  {avgNeutrality !== '—' && (
                    <div className={`stat-badge ${getBadgeClass(parseFloat(avgNeutrality))}`}>
                      {parseFloat(avgNeutrality) > 0.7 ? 'Excelente' : parseFloat(avgNeutrality) > 0.4 ? 'Moderado' : 'Atenção'}
                    </div>
                  )}
                </div>
                <div className="stat-card">
                  <div className="stat-label"><AlertCircle size={13} /> Alucinação</div>
                  <div className="stat-value" style={{ fontSize: 26 }}>{avgHallucination !== '—' ? `${(avgHallucination * 100).toFixed(0)}%` : '—'}</div>
                  {avgHallucination !== '—' && (
                    <div className={`stat-badge ${getBadgeClass(parseFloat(avgHallucination))}`}>
                      {parseFloat(avgHallucination) > 0.7 ? 'Seguro' : parseFloat(avgHallucination) > 0.4 ? 'Alerta' : 'Crítico'}
                    </div>
                  )}
                </div>
                <div className="stat-card">
                  <div className="stat-label"><Clock size={13} /> Integridade Geral</div>
                  <div className="stat-value" style={{ fontSize: 26 }}>
                    {latestScore !== null ? `${(latestScore * 100).toFixed(0)}%` : '—'}
                  </div>
                  <div className={`stat-badge ${getBadgeClass(parseFloat(latestScore))}`}>
                      {parseFloat(latestScore) > 0.7 ? 'Seguro' : parseFloat(latestScore) > 0.4 ? 'Alerta' : 'Crítico'}
                  </div>
                </div>
              </div>

              {evaluations.length > 0 ? (
                <>
                  <div className="charts-grid">
                    <div className="chart-card">
                      <div className="chart-title">Radar de Métricas</div>
                      <div className="chart-subtitle">Última avaliação executada</div>
                      <div style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={getRadarData()}>
                            <PolarGrid stroke="#1e1e2e" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#555566', fontSize: 11 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 1]} tick={false} axisLine={false} />
                            <Radar name="Score" dataKey="A" stroke="#a855f7" fill="#7c3aed" fillOpacity={0.25} strokeWidth={2} />
                            <Legend wrapperStyle={{ color: '#555566', fontSize: 12 }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="chart-card">
                      <div className="chart-title">Tendência Histórica</div>
                      <div className="chart-subtitle">Últimas {Math.min(evaluations.length, 8)} avaliações</div>
                      <div style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={getTrendData()}>
                            <defs>
                              <linearGradient id="gNeutral" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="gBias" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f87171" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="gRisk" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                            <XAxis dataKey="n" tick={{ fill: '#444455', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 1]} tick={{ fill: '#444455', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="neutralidade" name="Neutralidade" stroke="#a855f7" fill="url(#gNeutral)" strokeWidth={2} dot={false} />
                            <Area type="monotone" dataKey="vies" name="Viés Eleitoral" stroke="#f87171" fill="url(#gBias)" strokeWidth={2} dot={false} />
                            <Area type="monotone" dataKey="integridade" name="Integridade Geral" stroke="#ef4444" fill="url(#gRisk)" strokeWidth={2} dot={false} />
                            <Legend wrapperStyle={{ color: '#555566', fontSize: 12 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="chart-card" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <div className="chart-title">Última Avaliação</div>
                        <div className="chart-subtitle">Detalhes do teste mais recente</div>
                      </div>
                      <button
                        onClick={() => setActiveTab('history')}
                        style={{ background: 'none', border: '1px solid #2e2e42', borderRadius: 8, color: '#888899', padding: '6px 14px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        Ver todos <ChevronRight size={13} />
                      </button>
                    </div>
                    {evaluations[0] && (
                      <div style={{ fontSize: 13, color: '#888899', lineHeight: 1.7 }}>
                        <div style={{ marginBottom: 10 }}>
                          <span style={{ color: '#444455', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Input</span>
                          <p style={{ marginTop: 4, color: '#aaaacc' }}>{evaluations[0].input?.substring(0, 200)}{evaluations[0].input?.length > 200 ? '...' : ''}</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                          <div>
                            <span style={{ color: '#444455', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Direção do Viés Político</span>
                            <p style={{ marginTop: 4 }}>{evaluations[0].bias_direction_reason || '—'}</p>
                          </div>
                          <div>
                            <span style={{ color: '#444455', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Neutralidade Política</span>
                            <p style={{ marginTop: 4 }}>{evaluations[0].neutrality_reason || '—'}</p>
                          </div>
                          <div>
                            <span style={{ color: '#444455', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Viés Eleitoral</span>
                            <p style={{ marginTop: 4 }}>{evaluations[0].electoral_bias_reason || '—'}</p>
                          </div>
                          <div>
                            <span style={{ color: '#444455', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Não-Alucinação Factual</span>
                            <p style={{ marginTop: 4 }}>{evaluations[0].hallucination_reason || '—'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📊</div>
                  <h3>Nenhuma avaliação ainda</h3>
                  <p style={{ fontSize: 14, marginTop: 8 }}>Vá em "Nova Avaliação" para começar a monitorar sua IA.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'run' && (
            <div className="run-container">
              <div className="page-header">
                <h1>Nova Avaliação</h1>
                <p>Analise o comportamento da sua IA com o Gemini</p>
              </div>

              <div className="info-box">
                <Zap size={16} style={{ color: '#a855f7', flexShrink: 0, marginTop: 2 }} />
                <span>A avaliação analisa neutralidade política, viés cognitivo e qualidade geral da resposta. O processo pode levar alguns segundos.</span>
              </div>

              <div className="field-group">
                <div className="field-label"><Play size={13} /> Prompt enviado à IA</div>
                <textarea
                  className="field-textarea"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="Digite ou cole aqui o prompt que você enviou para a IA..."
                  disabled={loading}
                />
              </div>

              <div className="field-group">
                <div className="field-label"><Activity size={13} /> Resposta da IA</div>
                <textarea
                  className="field-textarea"
                  value={output}
                  onChange={e => setOutput(e.target.value)}
                  rows={7}
                  placeholder="Cole aqui a resposta gerada pela IA que você deseja avaliar..."
                  disabled={loading}
                />
              </div>

              <div className="field-group">
                <div className="field-label">🤖 Modelo utilizado (opcional)</div>
                <select
                  className="field-select"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Selecione um modelo...</option>
                  <option value="ChatGPT">ChatGPT</option>
                  <option value="Claude">Claude</option>
                  <option value="Gemini">Gemini</option>
                  <option value="Llama">Llama</option>
                  <option value="Mistral">Mistral</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <button
                className={`run-btn ${loading ? 'loading' : ''}`}
                onClick={handleRunTest}
                disabled={loading}
              >
                {loading ? (
                  <><div className="spinner" /> Avaliando com Gemini...</>
                ) : (
                  <><Zap size={18} /> Iniciar Avaliação</>
                )}
              </button>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <h1>Histórico</h1>
                  <p>{evaluations.length} avaliações registradas</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {evaluations.length > 0 && (
                    <button className="export-btn" onClick={handleExportCSV}>
                      <Download size={15} /> Exportar CSV
                    </button>
                  )}
                  <button
                    onClick={fetchEvaluations}
                    style={{ background: '#0f0f1a', border: '1px solid #1e1e2e', borderRadius: 10, color: '#888899', padding: '8px 16px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <RefreshCw size={14} /> Atualizar
                  </button>
                </div>
              </div>

              {evaluations.length > 0 ? (
                <div className="history-list">
                  {evaluations.map(ev => {
                    const score = ev.composite_risk_score ?? 0;
                    return (
                      <div 
                        className="history-card" 
                        key={ev.id}
                        onClick={() => handleSelectEvaluation(ev.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="history-top">
                          <div className="history-meta">
                            <span className="history-id">#{ev.id}</span>
                            <Clock size={12} />
                            {new Date(ev.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {ev.model && <span style={{ marginLeft: '12px', fontSize: '12px', color: '#888899' }}>🤖 {ev.model}</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className={`score-pill ${getScoreClass(score)}`}>
                              Integridade {(score * 100).toFixed(0)}%
                            </span>
                            <button
                              onClick={() => handleDeleteEvaluation(ev.id)}
                              className="delete-btn"
                              title="Deletar esta avaliação"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="history-input">
                          <strong style={{ color: '#444455', fontSize: 11 }}>INPUT</strong> &nbsp;
                          {ev.input?.substring(0, 120)}{ev.input?.length > 120 ? '…' : ''}
                        </div>
                        {ev.bias_direction_reason && (
                          <div className="history-reason">{ev.bias_direction_reason}</div>
                        )}
                        <div className="history-scores">
                          <div className="mini-score">
                            <span>Neutralidade</span>
                            <strong>{ev.neutrality_score !== undefined ? `${(ev.neutrality_score * 100).toFixed(0)}%` : '—'}</strong>
                          </div>
                          <div className="mini-score">
                            <span>Viés Eleitoral</span>
                            <strong>{ev.electoral_bias_score !== undefined ? `${(ev.electoral_bias_score * 100).toFixed(0)}%` : '—'}</strong>
                          </div>
                          <div className="mini-score">
                            <span>Não-Alucinação</span>
                            <strong>{ev.hallucination_score !== undefined ? `${(ev.hallucination_score * 100).toFixed(0)}%` : '—'}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🗂️</div>
                  <h3>Histórico vazio</h3>
                  <p style={{ fontSize: 14, marginTop: 8 }}>Execute sua primeira avaliação para ver o histórico aqui.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'detail' && getSelectedEvaluation() && (
            <div>
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1>Detalhes da Avaliação #{getSelectedEvaluation().id}</h1>
                  <p>Análise completa de uma avaliação específica</p>
                </div>
                <button
                  onClick={() => setActiveTab('history')}
                  style={{ background: '#0f0f1a', border: '1px solid #1e1e2e', borderRadius: 10, color: '#888899', padding: '8px 16px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  ← Voltar ao Histórico
                </button>
              </div>

              {getSelectedEvaluation() && (
                <>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-label"><Shield size={13} /> Neutralidade</div>
                      <div className="stat-value" style={{ fontSize: 26 }}>{(getSelectedEvaluation().neutrality_score * 100).toFixed(0)}%</div>
                      <div className={`stat-badge ${getBadgeClass(getSelectedEvaluation().neutrality_score)}`}>
                        {getSelectedEvaluation().neutrality_score > 0.7 ? 'Excelente' : getSelectedEvaluation().neutrality_score > 0.4 ? 'Moderado' : 'Atenção'}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label"><AlertCircle size={13} /> Viés Eleitoral</div>
                      <div className="stat-value" style={{ fontSize: 26 }}>{(getSelectedEvaluation().electoral_bias_score * 100).toFixed(0)}%</div>
                      <div className={`stat-badge ${getBadgeClass(getSelectedEvaluation().electoral_bias_score)}`}>
                        {getSelectedEvaluation().electoral_bias_score > 0.7 ? 'Baixo' : getSelectedEvaluation().electoral_bias_score > 0.4 ? 'Moderado' : 'Alto'}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label"><AlertCircle size={13} /> Não-Alucinação</div>
                      <div className="stat-value" style={{ fontSize: 26 }}>{(getSelectedEvaluation().hallucination_score * 100).toFixed(0)}%</div>
                      <div className={`stat-badge ${getBadgeClass(getSelectedEvaluation().hallucination_score)}`}>
                        {getSelectedEvaluation().hallucination_score > 0.7 ? 'Seguro' : getSelectedEvaluation().hallucination_score > 0.4 ? 'Alerta' : 'Crítico'}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label"><Clock size={13} /> Integridade Geral</div>
                      <div className="stat-value" style={{ fontSize: 26 }}>{(getSelectedEvaluation().composite_risk_score * 100).toFixed(0)}%</div>
                      <div className={`stat-badge ${getBadgeClass(getSelectedEvaluation().composite_risk_score)}`}>
                        {getSelectedEvaluation().composite_risk_score > 0.7 ? 'Seguro' : getSelectedEvaluation().composite_risk_score > 0.4 ? 'Alerta' : 'Crítico'}
                      </div>
                    </div>
                  </div>

                  <div className="charts-grid">
                    <div className="chart-card">
                      <div className="chart-title">Radar de Métricas</div>
                      <div className="chart-subtitle">Perfil completo da avaliação</div>
                      <div style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={getDetailRadarData()}>
                            <PolarGrid stroke="#1e1e2e" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#555566', fontSize: 11 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 1]} tick={false} axisLine={false} />
                            <Radar name="Score" dataKey="A" stroke="#a855f7" fill="#7c3aed" fillOpacity={0.25} strokeWidth={2} />
                            <Legend wrapperStyle={{ color: '#555566', fontSize: 12 }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="chart-card">
                      <div className="chart-title">Dados da Avaliação</div>
                      <div className="chart-subtitle">{new Date(getSelectedEvaluation().created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      <div style={{ fontSize: 13, color: '#888899', lineHeight: 1.7 }}>
                        <div style={{ marginBottom: 15 }}>
                          <span style={{ color: '#444455', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pergunta</span>
                          <p style={{ marginTop: 4, color: '#aaaacc' }}>{getSelectedEvaluation().input}</p>
                        </div>
                        {getSelectedEvaluation().model && (
                          <div style={{ marginBottom: 15 }}>
                            <span style={{ color: '#444455', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>🤖 Modelo Utilizado</span>
                            <p style={{ marginTop: 4, color: '#aaaacc' }}>{getSelectedEvaluation().model}</p>
                          </div>
                        )}
                        <div>
                          <span style={{ color: '#444455', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Resposta da IA</span>
                          <p style={{ marginTop: 4, color: '#aaaacc' }}>{getSelectedEvaluation().actual_output}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="charts-grid">
                    <div className="chart-card">
                      <div className="chart-title">Neutralidade Política</div>
                      <div className="chart-subtitle">Análise detalhada</div>
                      <div style={{ fontSize: 13, color: '#888899', lineHeight: 1.8 }}>
                        <div style={{ marginBottom: 12 }}>
                          <span style={{ color: '#a855f7', fontWeight: 600 }}>Score: {(getSelectedEvaluation().neutrality_score * 100).toFixed(1)}%</span>
                        </div>
                        {getSelectedEvaluation().neutrality_is_stable && (
                          <div style={{ color: '#4ade80', fontSize: 12, marginBottom: 8 }}>✓ Estável em múltiplas rodadas</div>
                        )}
                        <p>{getSelectedEvaluation().neutrality_reason || '—'}</p>
                      </div>
                    </div>

                    <div className="chart-card">
                      <div className="chart-title">Viés Político-Eleitoral</div>
                      <div className="chart-subtitle">Análise detalhada</div>
                      <div style={{ fontSize: 13, color: '#888899', lineHeight: 1.8 }}>
                        <div style={{ marginBottom: 12 }}>
                          <span style={{ color: '#f87171', fontWeight: 600 }}>Score: {(getSelectedEvaluation().electoral_bias_score * 100).toFixed(1)}%</span>
                        </div>
                        {getSelectedEvaluation().electoral_bias_is_stable && (
                          <div style={{ color: '#4ade80', fontSize: 12, marginBottom: 8 }}>✓ Estável em múltiplas rodadas</div>
                        )}
                        <p>{getSelectedEvaluation().electoral_bias_reason || '—'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="charts-grid">
                    <div className="chart-card">
                      <div className="chart-title">Não-Alucinação Factual</div>
                      <div className="chart-subtitle">Análise detalhada</div>
                      <div style={{ fontSize: 13, color: '#888899', lineHeight: 1.8 }}>
                        <div style={{ marginBottom: 12 }}>
                          <span style={{ color: '#60a5fa', fontWeight: 600 }}>Score: {(getSelectedEvaluation().hallucination_score * 100).toFixed(1)}%</span>
                        </div>
                        {getSelectedEvaluation().hallucination_is_stable && (
                          <div style={{ color: '#4ade80', fontSize: 12, marginBottom: 8 }}>✓ Estável em múltiplas rodadas</div>
                        )}
                        <p>{getSelectedEvaluation().hallucination_reason || '—'}</p>
                      </div>
                    </div>

                    <div className="chart-card">
                      <div className="chart-title">Direção do Viés Político</div>
                      <div className="chart-subtitle">Classificação identificada</div>
                      <div style={{ fontSize: 13, color: '#888899', lineHeight: 1.8 }}>
                        <p>{getSelectedEvaluation().bias_direction_reason || 'Sem viés identificado ou classificação não aplicável'}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
