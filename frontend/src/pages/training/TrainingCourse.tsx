import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ChevronLeft, ChevronRight, CheckCircle, Clock, BookOpen, AlertTriangle } from 'lucide-react';

interface Section {
  title: string;
  content: string;
}

interface TrainingModule {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationMinutes: number;
  sections: Section[];
  questionCount: number;
  passThreshold: number;
}

interface Question {
  id: string;
  question: string;
  options: string[];
  _map?: number[];  // originalIndices mapping from backend shuffle
}

interface AttemptResult {
  score: number;
  totalQuestions: number;
  correctCount: number;
  passed: boolean;
  passThreshold: number;
}

function renderMarkdown(md: string) {
  const lines = md.split('\n');
  const elements: JSX.Element[] = [];
  let i = 0;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc pl-6 space-y-1.5 text-sm text-foreground/90">
          {listItems.map((item, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const inlineFormat = (text: string) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>');
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      flushList();
      elements.push(<h2 key={i} className="text-lg font-semibold text-foreground mt-6 mb-3">{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      flushList();
      elements.push(<h3 key={i} className="text-base font-semibold text-foreground mt-5 mb-2">{line.slice(4)}</h3>);
    } else if (line.startsWith('- ')) {
      listItems.push(line.slice(2));
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={i} className="text-sm text-foreground/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
      );
    }
    i++;
  }
  flushList();
  return elements;
}

interface ShuffledQuestion {
  id: string;
  question: string;
  options: string[];           // shuffled display order
  originalIndices: number[];   // originalIndices[displayPos] = original index
}

/**
 * Shuffle question order and remap options from backend-shuffled data.
 * The backend handles option shuffling with the constraint that the correct
 * answer never occupies the same position in consecutive questions.
 * The frontend just shuffles question order and builds the index map.
 */
/** Backend handles both question order and option shuffling with constraints.
 *  Frontend just maps the response into the ShuffledQuestion format. */
function mapQuestions(questions: Question[]): ShuffledQuestion[] {
  return questions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
    originalIndices: q._map || q.options.map((_, i) => i),
  }));
}

export default function TrainingCourse() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [mod, setMod] = useState<TrainingModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState(0);
  const [visitedSections, setVisitedSections] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem(`kmi-confirmed-${slug}`);
      const confirmed = stored ? (JSON.parse(stored) as number[]) : [];
      return new Set([0, ...confirmed]);
    } catch { return new Set([0]); }
  });
  const [completed, setCompleted] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAcknowledge, setShowAcknowledge] = useState(false);
  const [confirmedSections, setConfirmedSections] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem(`kmi-confirmed-${slug}`);
      return stored ? new Set(JSON.parse(stored) as number[]) : new Set();
    } catch { return new Set(); }
  });
  const [quizMode, setQuizMode] = useState(false);
  const [questions, setQuestions] = useState<ShuffledQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Map<string, number>>(() => {
    try {
      const stored = localStorage.getItem(`kmi-quiz-answers-${slug}`);
      return stored ? new Map(JSON.parse(stored) as [string, number][]) : new Map();
    } catch { return new Map(); }
  });
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);

  // Persist confirmed sections to localStorage
  useEffect(() => {
    if (slug && confirmedSections.size > 0) {
      localStorage.setItem(`kmi-confirmed-${slug}`, JSON.stringify([...confirmedSections]));
    }
  }, [confirmedSections, slug]);

  // Persist quiz answers to localStorage
  useEffect(() => {
    if (slug && selectedAnswers.size > 0) {
      localStorage.setItem(`kmi-quiz-answers-${slug}`, JSON.stringify([...selectedAnswers]));
    }
  }, [selectedAnswers, slug]);

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      api.get(`/training/modules/${slug}`),
      api.get(`/training/modules/${slug}/my-completion`),
    ]).then(([modRes, compRes]) => {
      setMod(modRes.data.module);
      if (compRes.data.completed) {
        setCompleted(true);
        setCompletedAt(compRes.data.record.completedAt);
        // Mark all sections as visited and confirmed
        const allSections = new Set(modRes.data.module.sections.map((_: Section, i: number) => i));
        setVisitedSections(allSections);
        setConfirmedSections(allSections);
      }
    }).finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 bg-muted rounded animate-pulse w-64" />
        <Card><div className="h-96 animate-pulse bg-muted rounded" /></Card>
      </div>
    );
  }

  if (!mod) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Training module not found.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/training')}>Back to Training</Button>
      </div>
    );
  }

  const totalSections = mod.sections.length;
  const allVisited = visitedSections.size >= totalSections;
  const allConfirmed = confirmedSections.size >= totalSections;
  const section = mod.sections[currentSection];
  const isLastSection = currentSection === totalSections - 1;

  const goToSection = (index: number) => {
    setCurrentSection(index);
    setVisitedSections((prev) => new Set([...prev, index]));
  };

  const startQuiz = async () => {
    try {
      const res = await api.get(`/training/modules/${slug}/questions`);
      setQuestions(mapQuestions(res.data.questions));
      setCurrentQuestion(0);
      setSelectedAnswers(new Map());
      localStorage.removeItem(`kmi-quiz-answers-${slug}`);
      setAttemptResult(null);
      setQuizMode(true);
    } catch {
      // error loading questions
    }
  };

  const submitQuiz = async () => {
    setQuizSubmitting(true);
    try {
      const answers = questions.map((q) => {
        const displayIndex = selectedAnswers.get(q.id) ?? -1;
        const originalIndex = displayIndex >= 0 ? q.originalIndices[displayIndex] : -1;
        return { questionId: q.id, selectedIndex: originalIndex };
      });
      const res = await api.post(`/training/modules/${slug}/assess`, { answers });
      setAttemptResult(res.data.attempt);
      if (res.data.attempt.passed) {
        setCompleted(true);
        setCompletedAt(new Date().toISOString());
        localStorage.removeItem(`kmi-confirmed-${slug}`);
        localStorage.removeItem(`kmi-quiz-answers-${slug}`);
      }
    } catch {
      // error
    } finally {
      setQuizSubmitting(false);
    }
  };

  const resetQuiz = () => {
    setQuizMode(false);
    setAttemptResult(null);
    setSelectedAnswers(new Map());
    setCurrentQuestion(0);
    setConfirmedSections(new Set());
    setVisitedSections(new Set([0]));
    setCurrentSection(0);
    localStorage.removeItem(`kmi-confirmed-${slug}`);
    localStorage.removeItem(`kmi-quiz-answers-${slug}`);
  };

  const hasQuestions = (mod?.questionCount ?? 0) > 0;
  const allQuestionsAnswered = questions.length > 0 && selectedAnswers.size === questions.length;

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      await api.post(`/training/modules/${slug}/complete`);
      setCompleted(true);
      setCompletedAt(new Date().toISOString());
    } catch {
      // already completed or error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/training')} className="text-sm text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Back to Training
        </button>
        <h2 className="text-xl font-semibold text-foreground">{mod.title}</h2>
        <div className="flex items-center gap-3 mt-2">
          <Badge variant="info"><Clock className="w-3 h-3 mr-1" />{mod.durationMinutes} min</Badge>
          <Badge variant="default"><BookOpen className="w-3 h-3 mr-1" />{totalSections} sections</Badge>
          {completed && (
            <>
              <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" />Completed {completedAt ? new Date(completedAt).toLocaleDateString() : ''}</Badge>
              {hasQuestions && (
                <button
                  onClick={() => {
                    setCompleted(false);
                    setCompletedAt(null);
                    setConfirmedSections(new Set());
                    setVisitedSections(new Set([0]));
                    setCurrentSection(0);
                    localStorage.removeItem(`kmi-confirmed-${slug}`);
                    localStorage.removeItem(`kmi-quiz-answers-${slug}`);
                  }}
                  className="text-xs text-kmi-bright hover:underline"
                >
                  Retake Assessment
                </button>
              )}
            </>
          )}
          {isAdmin && (
            <Link to={`/training/modules/${slug}/questions`} className="text-xs text-kmi-bright hover:underline ml-2">
              Manage Questions
            </Link>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>Section {currentSection + 1} of {totalSections}</span>
          <span>{visitedSections.size}/{totalSections} viewed</span>
        </div>
        <div className="flex gap-1">
          {mod.sections.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSection(i)}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i === currentSection
                  ? 'bg-primary'
                  : visitedSections.has(i)
                  ? 'bg-kmi-bright/50'
                  : 'bg-muted'
              }`}
              title={mod.sections[i].title}
            />
          ))}
        </div>
      </div>

      {/* Section navigation tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {mod.sections.map((s, i) => (
          <button
            key={i}
            onClick={() => goToSection(i)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              i === currentSection
                ? 'bg-primary text-primary-foreground'
                : visitedSections.has(i)
                ? 'bg-sky-50 text-kmi-primary'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            {i + 1}. {s.title}
          </button>
        ))}
      </div>

      {/* Content */}
      <Card>
        <CardContent className="py-6 space-y-3">
          <h3 className="text-lg font-semibold text-foreground border-b border-border pb-3 mb-4">
            {section.title}
          </h3>
          <div className="space-y-3">
            {renderMarkdown(section.content)}
          </div>

          {/* Confirmation checkbox */}
          {!completed && (
            <div className="border-t border-border pt-4 mt-6">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={confirmedSections.has(currentSection)}
                  onChange={(e) => {
                    setConfirmedSections((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) {
                        next.add(currentSection);
                      } else {
                        next.delete(currentSection);
                      }
                      return next;
                    });
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-kmi-primary focus:ring-kmi-primary accent-kmi-primary"
                />
                <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                  I confirm I have read and understood the content in this section.
                </span>
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-4">
        <Button
          variant="outline"
          size="sm"
          disabled={currentSection === 0}
          onClick={() => goToSection(currentSection - 1)}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Previous
        </Button>

        {isLastSection && !completed ? (
          hasQuestions ? (
            <Button
              size="sm"
              disabled={!allConfirmed}
              onClick={startQuiz}
              title={allConfirmed ? 'Take assessment' : 'Confirm all sections first'}
            >
              <CheckCircle className="w-4 h-4 mr-1" /> Take Assessment
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={!allConfirmed}
              onClick={() => setShowAcknowledge(true)}
              title={allConfirmed ? 'Complete training' : 'Confirm all sections first'}
            >
              <CheckCircle className="w-4 h-4 mr-1" /> Complete Training
            </Button>
          )
        ) : !isLastSection ? (
          <Button
            size="sm"
            disabled={!completed && !confirmedSections.has(currentSection)}
            onClick={() => goToSection(currentSection + 1)}
            title={!completed && !confirmedSections.has(currentSection) ? 'Please confirm you have understood this section first' : 'Go to next section'}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : null}
      </div>

      {/* Acknowledgement dialog */}
      {showAcknowledge && !completed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardContent className="py-6">
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-full bg-sky-50 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-kmi-primary" />
                </div>
                <h3 className="text-lg font-semibold">Complete Training</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                By completing this training, you confirm that you have read and understood all sections:
              </p>
              <ul className="text-sm text-foreground space-y-1.5 mb-6 pl-4">
                {mod.sections.map((s, i) => (
                  <li key={i} className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-kmi-bright mt-0.5 flex-shrink-0" /> {s.title}</li>
                ))}
              </ul>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={handleComplete} disabled={submitting}>
                  {submitting ? 'Recording...' : 'I Confirm & Acknowledge'}
                </Button>
                <Button variant="secondary" onClick={() => setShowAcknowledge(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Completion confirmation */}
      {completed && isLastSection && (
        <Card className="mt-4 border-kmi-bright/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-kmi-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Training Complete</p>
                <p className="text-xs text-muted-foreground">
                  You completed this training on {completedAt ? new Date(completedAt).toLocaleDateString() : 'today'}. Your completion has been recorded.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assessment Quiz */}
      {quizMode && !attemptResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <CardContent className="py-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Assessment</h3>
                <span className="text-sm text-muted-foreground">
                  Question {currentQuestion + 1} of {questions.length}
                </span>
              </div>

              {/* Progress dots */}
              <div className="flex gap-1 mb-6">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      i === currentQuestion
                        ? 'bg-primary'
                        : selectedAnswers.has(questions[i].id)
                        ? 'bg-kmi-bright'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>

              <p className="text-sm font-medium text-foreground mb-4">
                {questions[currentQuestion]?.question}
              </p>

              <div className="space-y-2 mb-6">
                {questions[currentQuestion]?.options.map((option, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                      selectedAnswers.get(questions[currentQuestion].id) === i
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion}`}
                      checked={selectedAnswers.get(questions[currentQuestion].id) === i}
                      onChange={() => {
                        setSelectedAnswers((prev) => {
                          const next = new Map(prev);
                          next.set(questions[currentQuestion].id, i);
                          return next;
                        });
                      }}
                      className="accent-primary"
                    />
                    <span className="text-sm">{String.fromCharCode(65 + i)}. {option}</span>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentQuestion === 0}
                  onClick={() => setCurrentQuestion((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>

                {currentQuestion < questions.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() => setCurrentQuestion((p) => p + 1)}
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={!allQuestionsAnswered || quizSubmitting}
                    onClick={submitQuiz}
                  >
                    {quizSubmitting ? 'Submitting...' : 'Submit Assessment'}
                  </Button>
                )}
              </div>

              <button
                onClick={() => setQuizMode(false)}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-4"
              >
                Cancel and return to training
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Assessment Result */}
      {attemptResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardContent className="py-6 text-center">
              {attemptResult.passed ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Assessment Passed</h3>
                  <p className="text-3xl font-bold text-emerald-600 mb-1">{attemptResult.score}%</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    You scored {attemptResult.correctCount} out of {attemptResult.totalQuestions} (pass mark: {attemptResult.passThreshold}%)
                  </p>
                  <Button onClick={() => { setAttemptResult(null); setQuizMode(false); }}>
                    Done
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Assessment Not Passed</h3>
                  <p className="text-3xl font-bold text-red-500 mb-1">{attemptResult.score}%</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    You scored {attemptResult.correctCount} out of {attemptResult.totalQuestions}. The pass mark is {attemptResult.passThreshold}%.
                    Please review the training material and retake the assessment.
                  </p>
                  <Button onClick={resetQuiz}>
                    Review Training Material
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
