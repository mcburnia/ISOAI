import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import api from '../api/client';
import { CheckCircle, XCircle, HelpCircle, ChevronDown } from 'lucide-react';

interface PendingQuestion {
  questionId: string;
  instanceId: string;
  moduleTitle: string;
  question: string;
  options: string[];
  hint: string;
}

interface AnswerResult {
  correct: boolean;
  explanation: string;
  rollingScore: number;
  currentFrequency: 'daily' | 'weekly';
}

interface Props {
  onClose: () => void;
}

export default function CompetenceCheckModal({ onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingQuestion | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);

  useEffect(() => {
    api.get('/competence/pending')
      .then((res) => setPending(res.data.question))
      .finally(() => setLoading(false));
  }, []);

  const handleShowHint = () => {
    setHintVisible(true);
    setHintUsed(true);
  };

  const handleSubmit = async () => {
    if (!pending || selectedIndex === null) return;
    setSubmitting(true);
    try {
      const res = await api.post('/competence/answer', {
        questionId: pending.questionId,
        selectedIndex,
        instanceId: pending.instanceId,
        usedHint: hintUsed,
      });
      setResult(res.data);
    } catch {
      // submission failed
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="py-6">
            <div className="h-32 animate-pulse bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <CardContent className="py-6">
          {/* No pending question */}
          {!pending && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">No competence checks due</p>
              <Button variant="secondary" onClick={onClose}>Close</Button>
            </div>
          )}

          {/* Question view (before submission) */}
          {pending && !result && (
            <>
              <div className="mb-4">
                <Badge variant="info">{pending.moduleTitle}</Badge>
              </div>

              <p className="text-sm font-medium text-foreground mb-4">
                {pending.question}
              </p>

              <div className="space-y-2 mb-4">
                {pending.options.map((option, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                      selectedIndex === i
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="competence-option"
                      checked={selectedIndex === i}
                      onChange={() => setSelectedIndex(i)}
                      className="accent-primary"
                    />
                    <span className="text-sm">{String.fromCharCode(65 + i)}. {option}</span>
                  </label>
                ))}
              </div>

              {/* Hint toggle */}
              {pending.hint && (
                <div className="mb-4">
                  {!hintVisible ? (
                    <button
                      onClick={handleShowHint}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      Show Hint
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  ) : (
                    <div className="bg-sky-50 border border-sky-200 rounded-md p-3">
                      <p className="text-xs text-sky-800">{pending.hint}</p>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={selectedIndex === null || submitting}
                className="w-full"
              >
                {submitting ? 'Submitting...' : 'Submit Answer'}
              </Button>
            </>
          )}

          {/* Result view */}
          {pending && result && (
            <div className="text-center">
              {result.correct ? (
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
              )}

              <h3 className={`text-lg font-semibold mb-2 ${result.correct ? 'text-emerald-700' : 'text-red-600'}`}>
                {result.correct ? 'Correct' : 'Incorrect'}
              </h3>

              <p className="text-sm text-muted-foreground mb-4">
                {result.explanation}
              </p>

              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{result.rollingScore}%</p>
                  <p className="text-xs text-muted-foreground">Rolling score</p>
                </div>
                <div className="text-center">
                  <Badge variant={result.currentFrequency === 'daily' ? 'warning' : 'success'}>
                    {result.currentFrequency}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">Frequency</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mb-6">
                {!result.correct
                  ? 'Your check frequency may increase to daily until your score improves.'
                  : hintUsed
                  ? 'Well done. Note that hint usage is tracked in your competence score.'
                  : 'Excellent — full marks for this check.'}
              </p>

              <Button variant="secondary" onClick={onClose}>Close</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
