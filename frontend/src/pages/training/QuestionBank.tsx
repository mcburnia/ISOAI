import { useEffect, useState } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import {
  Plus,
  X,
  Pencil,
  Trash2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  hint: string | null;
}

interface ModuleInfo {
  id: string;
  slug: string;
  title: string;
  passThreshold: number;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const emptyForm = {
  questionText: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  explanation: '',
  hint: '',
};

export default function QuestionBank() {
  const { slug } = useParams<{ slug: string }>();
  const { isAdmin } = useAuth();

  const [mod, setMod] = useState<ModuleInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [passThreshold, setPassThreshold] = useState<number>(80);
  const [savingThreshold, setSavingThreshold] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      api.get(`/training/modules/${slug}`),
      api.get(`/training/modules/${slug}/questions?manage=true`),
    ])
      .then(([modRes, qRes]) => {
        setMod(modRes.data.module);
        setPassThreshold(modRes.data.module.passThreshold ?? 80);
        setQuestions(qRes.data.questions);
      })
      .catch(() => setErrorMsg('Failed to load module data.'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const flash = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setErrorMsg('');
    } else {
      setErrorMsg(msg);
      setSuccessMsg('');
    }
    setTimeout(() => {
      setSuccessMsg('');
      setErrorMsg('');
    }, 4000);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleSaveThreshold = async () => {
    setSavingThreshold(true);
    try {
      await api.patch(`/training/modules/${slug}/pass-threshold`, {
        passThreshold,
      });
      flash('Pass threshold updated.', 'success');
    } catch {
      flash('Failed to update pass threshold.', 'error');
    } finally {
      setSavingThreshold(false);
    }
  };

  const handleSaveQuestion = async () => {
    if (!form.questionText.trim()) {
      flash('Question text is required.', 'error');
      return;
    }
    if (form.options.some((o) => !o.trim())) {
      flash('All four options are required.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        questionText: form.questionText.trim(),
        options: form.options.map((o) => o.trim()),
        correctIndex: form.correctIndex,
        explanation: form.explanation.trim() || null,
        hint: form.hint.trim() || null,
      };

      if (editingId) {
        const res = await api.put(
          `/training/modules/${slug}/questions/${editingId}`,
          payload
        );
        setQuestions((prev) =>
          prev.map((q) => (q.id === editingId ? res.data.question : q))
        );
        flash('Question updated.', 'success');
      } else {
        const res = await api.post(
          `/training/modules/${slug}/questions`,
          payload
        );
        setQuestions((prev) => [...prev, res.data.question]);
        flash('Question added.', 'success');
      }
      resetForm();
    } catch {
      flash('Failed to save question.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setShowAddForm(false);
    setForm({
      questionText: q.questionText,
      options: [...q.options],
      correctIndex: q.correctIndex,
      explanation: q.explanation ?? '',
      hint: q.hint ?? '',
    });
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await api.delete(`/training/modules/${slug}/questions/${id}`);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      setDeleteConfirmId(null);
      flash('Question deleted.', 'success');
    } catch {
      flash('Failed to delete question.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const updateOption = (index: number, value: string) => {
    setForm((prev) => {
      const options = [...prev.options];
      options[index] = value;
      return { ...prev, options };
    });
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 bg-muted rounded animate-pulse w-64" />
        <div className="h-40 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!mod) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Module not found.</p>
      </div>
    );
  }

  const questionForm = (
    <Card className="border-kmi-bright/30">
      <CardHeader>
        <h3 className="text-sm font-semibold text-foreground">
          {editingId ? 'Edit Question' : 'New Question'}
        </h3>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Question text
          </label>
          <textarea
            value={form.questionText}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, questionText: e.target.value }))
            }
            rows={3}
            className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Enter the question..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OPTION_LABELS.map((label, i) => (
            <Input
              key={label}
              label={`Option ${label}`}
              value={form.options[i]}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Option ${label}`}
            />
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Correct answer
          </label>
          <div className="flex gap-4">
            {OPTION_LABELS.map((label, i) => (
              <label key={label} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="correctAnswer"
                  checked={form.correctIndex === i}
                  onChange={() =>
                    setForm((prev) => ({ ...prev, correctIndex: i }))
                  }
                  className="accent-kmi-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Explanation <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            value={form.explanation}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, explanation: e.target.value }))
            }
            rows={2}
            className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Why this answer is correct..."
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Refresher hint — shown during competence checks{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            value={form.hint}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, hint: e.target.value }))
            }
            rows={2}
            className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="A brief hint to help the learner recall the concept..."
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" onClick={handleSaveQuestion} disabled={saving}>
            {saving ? 'Saving...' : editingId ? 'Update Question' : 'Save Question'}
          </Button>
          <Button variant="secondary" size="sm" onClick={resetForm}>
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={`/training/${slug}`}
          className="text-sm text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Module
        </Link>
        <h2 className="text-xl font-semibold text-foreground mt-2">
          Question Bank — {mod.title}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage assessment questions for this training module.
        </p>
      </div>

      {/* Flash messages */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-emerald-50 text-emerald-700 px-4 py-2.5 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-red-50 text-red-700 px-4 py-2.5 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorMsg}
        </div>
      )}

      {/* Pass threshold */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="Pass threshold (%)"
                type="number"
                min={0}
                max={100}
                value={passThreshold}
                onChange={(e) => setPassThreshold(Number(e.target.value))}
                className="max-w-[120px]"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveThreshold}
              disabled={savingThreshold}
            >
              {savingThreshold ? 'Saving...' : 'Save'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Learners must score at least this percentage to pass the assessment.
          </p>
        </CardContent>
      </Card>

      {/* Add question button */}
      {!showAddForm && !editingId && (
        <div className="mb-4">
          <Button
            size="sm"
            onClick={() => {
              setShowAddForm(true);
              setForm(emptyForm);
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Add Question
          </Button>
        </div>
      )}

      {/* Add form */}
      {showAddForm && !editingId && <div className="mb-6">{questionForm}</div>}

      {/* Questions list */}
      {questions.length === 0 && !showAddForm ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No questions yet. Add your first question to build the assessment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={q.id}>
              {editingId === q.id ? (
                questionForm
              ) : (
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">
                        <span className="text-muted-foreground mr-1.5">
                          {qi + 1}.
                        </span>
                        {q.questionText}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => startEdit(q)}
                          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit question"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {deleteConfirmId === q.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(q.id)}
                              disabled={deleting}
                            >
                              {deleting ? 'Deleting...' : 'Confirm'}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(q.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                            title="Delete question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-3">
                      {q.options.map((opt, oi) => (
                        <div
                          key={oi}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${
                            oi === q.correctIndex
                              ? 'bg-emerald-50 text-emerald-700 font-medium'
                              : 'bg-muted/50 text-foreground/80'
                          }`}
                        >
                          <span className="font-semibold text-xs w-5">
                            {OPTION_LABELS[oi]}.
                          </span>
                          {opt}
                          {oi === q.correctIndex && (
                            <CheckCircle className="w-3.5 h-3.5 ml-auto flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>

                    {q.explanation && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/70">
                          Explanation:
                        </span>{' '}
                        {q.explanation}
                      </div>
                    )}

                    {q.hint && (
                      <div className="mt-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/70">
                          Refresher hint:
                        </span>{' '}
                        {q.hint}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
