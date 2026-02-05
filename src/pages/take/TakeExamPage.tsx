import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Paper,
  Button,
  Stack,
  Alert,
  Skeleton,
  Group,
  Badge,
  Textarea,
  Radio,
  Progress,
  Modal,
  FileButton,
  ActionIcon,
  Loader,
  Divider,
  Checkbox,
  TextInput,
  Select,
  SimpleGrid,
} from '@mantine/core';
import { IconAlertCircle, IconClock, IconCheck, IconUpload, IconFile, IconTrash, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  useGetExamForStudentQuery,
  useGetSessionQuery,
  useSaveAnswerMutation,
  useSubmitExamMutation,
  useGetAnswersForSessionQuery,
} from '../../services/sessions/sessionsApi';
import {
  Question,
  MultipleChoiceContent,
  FreeTextContent,
  FileUploadContent,
  KPrimContent,
  ClozeContent,
  MatchingContent,
  EssayContent,
  MultipleChoiceAnswer,
  FreeTextAnswer,
  FileUploadAnswer,
  KPrimAnswer,
  ClozeAnswer,
  MatchingAnswer,
  EssayAnswer,
  UploadedFile,
  ExamSectionWithQuestions,
} from '../../types/database';
import { supabase } from '../../services/common/supabase';

export const TakeExamPage = () => {
  const { examId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session');

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const { data: exam, isLoading: loadingExam } = useGetExamForStudentQuery(examId || '', {
    skip: !examId,
  });

  const { data: session, isLoading: loadingSession } = useGetSessionQuery(sessionId || '', {
    skip: !sessionId,
  });

  const { data: existingAnswers } = useGetAnswersForSessionQuery(sessionId || '', {
    skip: !sessionId,
  });

  const [saveAnswer] = useSaveAnswerMutation();
  const [submitExam, { isLoading: submitting }] = useSubmitExamMutation();

  // Determine if exam uses sections
  const hasSections = exam?.sections && exam.sections.length > 0;
  const sections = hasSections ? exam.sections : null;

  // Flatten all questions for progress tracking
  const allQuestions = hasSections
    ? sections!.flatMap((s) => s.questions)
    : exam?.questions || [];

  // Get current section's questions
  const currentSection = sections ? sections[currentSectionIndex] : null;
  const currentSectionQuestions = currentSection?.questions || allQuestions;

  // Load existing answers
  useEffect(() => {
    if (existingAnswers) {
      const loadedAnswers: Record<string, unknown> = {};
      existingAnswers.forEach((answer) => {
        loadedAnswers[answer.question_id] = answer.content;
      });
      setAnswers(loadedAnswers);
    }
  }, [existingAnswers]);

  // Timer
  useEffect(() => {
    if (!exam?.time_limit_minutes || !session?.started_at) return;

    const startTime = new Date(session.started_at).getTime();
    const endTime = startTime + exam.time_limit_minutes * 60 * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        handleSubmit();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [exam?.time_limit_minutes, session?.started_at]);

  const handleAnswerChange = useCallback(
    async (questionId: string, content: unknown) => {
      setAnswers((prev) => ({ ...prev, [questionId]: content }));

      if (sessionId) {
        try {
          await saveAnswer({
            session_id: sessionId,
            question_id: questionId,
            content,
          }).unwrap();
        } catch {
          // Silent fail - will retry on next change
        }
      }
    },
    [sessionId, saveAnswer]
  );

  const handleSubmit = async () => {
    if (!sessionId) return;

    try {
      await submitExam(sessionId).unwrap();
      notifications.show({
        title: 'Prüfung abgegeben',
        message: 'Ihre Antworten wurden erfolgreich gespeichert.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      navigate(`/take/${examId}/complete`);
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Prüfung konnte nicht abgegeben werden.',
        color: 'red',
      });
    }
  };

  if (loadingExam || loadingSession) {
    return (
      <Container size="md" py={50}>
        <Skeleton height={400} radius="md" />
      </Container>
    );
  }

  if (!exam || !session) {
    return (
      <Container size="md" py={50}>
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          Prüfung konnte nicht geladen werden.
        </Alert>
      </Container>
    );
  }

  if (session.submitted_at) {
    navigate(`/take/${examId}/complete`);
    return null;
  }

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = allQuestions.length;
  const progress = (answeredCount / totalQuestions) * 100;

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getSectionTotalPoints = (section: ExamSectionWithQuestions): number => {
    return section.questions.reduce((sum, q) => sum + q.points, 0);
  };

  const getSectionAnsweredCount = (section: ExamSectionWithQuestions): number => {
    return section.questions.filter((q) => answers[q.id] !== undefined).length;
  };

  const renderQuestion = (question: Question) => {
    switch (question.type) {
      case 'multiple_choice':
        return (
          <MultipleChoiceQuestion
            question={question}
            answer={answers[question.id] as MultipleChoiceAnswer | undefined}
            onChange={(content) => handleAnswerChange(question.id, content)}
          />
        );
      case 'free_text':
        return (
          <FreeTextQuestion
            question={question}
            answer={answers[question.id] as FreeTextAnswer | undefined}
            onChange={(content) => handleAnswerChange(question.id, content)}
          />
        );
      case 'file_upload':
        return (
          <FileUploadQuestion
            question={question}
            answer={answers[question.id] as FileUploadAnswer | undefined}
            sessionId={sessionId || ''}
            onChange={(content) => handleAnswerChange(question.id, content)}
          />
        );
      case 'kprim':
        return (
          <KPrimQuestion
            question={question}
            answer={answers[question.id] as KPrimAnswer | undefined}
            onChange={(content) => handleAnswerChange(question.id, content)}
          />
        );
      case 'cloze':
        return (
          <ClozeQuestion
            question={question}
            answer={answers[question.id] as ClozeAnswer | undefined}
            onChange={(content) => handleAnswerChange(question.id, content)}
          />
        );
      case 'matching':
        return (
          <MatchingQuestion
            question={question}
            answer={answers[question.id] as MatchingAnswer | undefined}
            onChange={(content) => handleAnswerChange(question.id, content)}
          />
        );
      case 'essay':
        return (
          <EssayQuestion
            question={question}
            answer={answers[question.id] as EssayAnswer | undefined}
            onChange={(content) => handleAnswerChange(question.id, content)}
          />
        );
      default:
        return <Text c="dimmed">Unbekannter Aufgabentyp</Text>;
    }
  };

  return (
    <Container size="md" py={30}>
      <Stack gap="lg">
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Title order={3}>{exam.title}</Title>
              <Text size="sm" c="dimmed">
                {session.student_name}
              </Text>
            </div>
            <Group gap="md">
              {timeRemaining !== null && (
                <Badge
                  size="lg"
                  color={timeRemaining < 300000 ? 'red' : 'blue'}
                  leftSection={<IconClock size={14} />}
                >
                  {formatTime(timeRemaining)}
                </Badge>
              )}
              <Badge size="lg" variant="outline">
                {answeredCount} / {totalQuestions}
              </Badge>
            </Group>
          </Group>
          <Progress value={progress} size="sm" mt="md" />
        </Paper>

        {/* Section Navigation (if using sections) */}
        {hasSections && sections && (
          <Paper p="md" radius="md" withBorder>
            <Text size="sm" fw={500} mb="sm">
              Sektionen
            </Text>
            <Group gap="xs">
              {sections.map((section, index) => {
                const sectionAnswered = getSectionAnsweredCount(section);
                const sectionTotal = section.questions.length;
                const isComplete = sectionAnswered === sectionTotal;
                return (
                  <Button
                    key={section.id}
                    size="sm"
                    variant={index === currentSectionIndex ? 'filled' : isComplete ? 'light' : 'subtle'}
                    color={isComplete ? 'green' : undefined}
                    onClick={() => setCurrentSectionIndex(index)}
                  >
                    {section.title} ({sectionAnswered}/{sectionTotal})
                  </Button>
                );
              })}
            </Group>
          </Paper>
        )}

        {/* Current Section Header */}
        {currentSection && (
          <Paper p="lg" radius="md" withBorder bg="blue.0">
            <Group justify="space-between">
              <div>
                <Badge mb="xs">Sektion {currentSectionIndex + 1} von {sections!.length}</Badge>
                <Title order={4}>{currentSection.title}</Title>
                {currentSection.description && (
                  <Text size="sm" c="dimmed" mt="xs">
                    {currentSection.description}
                  </Text>
                )}
              </div>
              <Badge size="lg" variant="light" color="blue">
                {getSectionTotalPoints(currentSection)} Punkte
              </Badge>
            </Group>
          </Paper>
        )}

        {/* Questions in current section */}
        <Stack gap="md">
          {currentSectionQuestions.map((question, index) => (
            <Paper key={question.id} p="lg" radius="md" withBorder>
              <Group justify="space-between" mb="md">
                <Badge>Frage {index + 1} von {currentSectionQuestions.length}</Badge>
                <Badge variant="outline">{question.points} Punkte</Badge>
              </Group>

              <Title order={4} mb="md">
                {question.title}
              </Title>

              <Text mb="lg">
                {(question.content as { question: string }).question}
              </Text>

              {renderQuestion(question)}

              {index < currentSectionQuestions.length - 1 && <Divider mt="lg" />}
            </Paper>
          ))}
        </Stack>

        {/* Navigation */}
        <Group justify="space-between">
          {hasSections && sections ? (
            <>
              <Button
                variant="light"
                onClick={() => setCurrentSectionIndex((i) => Math.max(0, i - 1))}
                disabled={currentSectionIndex === 0}
              >
                Vorherige Sektion
              </Button>
              {currentSectionIndex < sections.length - 1 ? (
                <Button onClick={() => setCurrentSectionIndex((i) => i + 1)}>
                  Nächste Sektion
                </Button>
              ) : (
                <Button color="green" onClick={() => setShowSubmitModal(true)}>
                  Prüfung abgeben
                </Button>
              )}
            </>
          ) : (
            <Button color="green" onClick={() => setShowSubmitModal(true)} style={{ marginLeft: 'auto' }}>
              Prüfung abgeben
            </Button>
          )}
        </Group>

        <Modal
          opened={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          title="Prüfung abgeben"
        >
          <Stack gap="md">
            <Text>
              Sind Sie sicher, dass Sie die Prüfung abgeben möchten? Sie können Ihre Antworten
              danach nicht mehr ändern.
            </Text>
            <Text size="sm" c="dimmed">
              Sie haben {answeredCount} von {totalQuestions} Fragen beantwortet.
            </Text>
            {answeredCount < totalQuestions && (
              <Alert icon={<IconAlertCircle size={16} />} color="orange">
                Sie haben noch nicht alle Fragen beantwortet!
              </Alert>
            )}
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setShowSubmitModal(false)}>
                Abbrechen
              </Button>
              <Button color="green" onClick={handleSubmit} loading={submitting}>
                Jetzt abgeben
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
};

const MultipleChoiceQuestion = ({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: MultipleChoiceAnswer | undefined;
  onChange: (content: MultipleChoiceAnswer) => void;
}) => {
  const content = question.content as MultipleChoiceContent;

  return (
    <Radio.Group
      value={answer?.selected_option_id || ''}
      onChange={(value) => onChange({ selected_option_id: value })}
    >
      <Stack gap="sm">
        {content.options.map((option) => (
          <Paper key={option.id} p="sm" withBorder style={{ cursor: 'pointer' }}>
            <Radio
              value={option.id}
              label={option.text}
              styles={{ label: { cursor: 'pointer' } }}
            />
          </Paper>
        ))}
      </Stack>
    </Radio.Group>
  );
};

const FreeTextQuestion = ({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: FreeTextAnswer | undefined;
  onChange: (content: FreeTextAnswer) => void;
}) => {
  const content = question.content as FreeTextContent;
  const minRows = content.expected_length === 'short' ? 2 : content.expected_length === 'long' ? 8 : 4;

  return (
    <Textarea
      placeholder="Geben Sie hier Ihre Antwort ein..."
      minRows={minRows}
      value={answer?.text || ''}
      onChange={(e) => onChange({ text: e.target.value })}
    />
  );
};

const FileUploadQuestion = ({
  question,
  answer,
  sessionId,
  onChange,
}: {
  question: Question;
  answer: FileUploadAnswer | undefined;
  sessionId: string;
  onChange: (content: FileUploadAnswer) => void;
}) => {
  const content = question.content as FileUploadContent;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const files = answer?.files || [];
  const maxFiles = content.max_files || 1;
  const maxSizeMB = content.max_file_size_mb || 10;
  const allowedTypes = content.allowed_types || [];

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (selectedFile: File | null) => {
    if (!selectedFile) return;
    setError(null);

    // Check file count
    if (files.length >= maxFiles) {
      setError(`Maximal ${maxFiles} Datei(en) erlaubt.`);
      return;
    }

    // Check file size
    if (selectedFile.size > maxSizeMB * 1024 * 1024) {
      setError(`Datei zu groß. Maximal ${maxSizeMB} MB erlaubt.`);
      return;
    }

    // Check file type
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    if (allowedTypes.length > 0 && extension && !allowedTypes.includes(extension)) {
      setError(`Dateityp nicht erlaubt. Erlaubt: ${allowedTypes.join(', ')}`);
      return;
    }

    setUploading(true);

    try {
      const filePath = `${sessionId}/${question.id}/${Date.now()}_${selectedFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from('exam-uploads')
        .upload(filePath, selectedFile);

      if (uploadError) {
        throw uploadError;
      }

      const newFile: UploadedFile = {
        name: selectedFile.name,
        path: filePath,
        size: selectedFile.size,
        type: selectedFile.type,
        uploaded_at: new Date().toISOString(),
      };

      onChange({
        files: [...files, newFile],
      });

      notifications.show({
        title: 'Datei hochgeladen',
        message: `${selectedFile.name} wurde erfolgreich hochgeladen.`,
        color: 'green',
      });
    } catch (err) {
      console.error('Upload error:', err);
      setError('Fehler beim Hochladen der Datei.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = async (fileToRemove: UploadedFile) => {
    try {
      await supabase.storage.from('exam-uploads').remove([fileToRemove.path]);

      onChange({
        files: files.filter((f) => f.path !== fileToRemove.path),
      });

      notifications.show({
        title: 'Datei entfernt',
        message: `${fileToRemove.name} wurde entfernt.`,
        color: 'blue',
      });
    } catch (err) {
      console.error('Delete error:', err);
      notifications.show({
        title: 'Fehler',
        message: 'Datei konnte nicht entfernt werden.',
        color: 'red',
      });
    }
  };

  return (
    <Stack gap="md">
      {error && (
        <Alert icon={<IconX size={16} />} color="red" onClose={() => setError(null)} withCloseButton>
          {error}
        </Alert>
      )}

      <Paper p="md" bg="gray.0" radius="md">
        <Group justify="space-between" mb="sm">
          <Text size="sm" c="dimmed">
            Erlaubte Dateitypen: {allowedTypes.join(', ') || 'Alle'}
          </Text>
          <Text size="sm" c="dimmed">
            Max. {maxSizeMB} MB | {files.length}/{maxFiles} Dateien
          </Text>
        </Group>

        <FileButton onChange={handleFileSelect} accept={allowedTypes.map(t => `.${t}`).join(',')}>
          {(props) => (
            <Button
              {...props}
              variant="light"
              leftSection={uploading ? <Loader size={16} /> : <IconUpload size={16} />}
              disabled={uploading || files.length >= maxFiles}
              fullWidth
            >
              {uploading ? 'Wird hochgeladen...' : 'Datei auswählen'}
            </Button>
          )}
        </FileButton>
      </Paper>

      {files.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={500}>Hochgeladene Dateien:</Text>
          {files.map((file) => (
            <Paper key={file.path} p="sm" withBorder>
              <Group justify="space-between">
                <Group gap="sm">
                  <IconFile size={20} />
                  <div>
                    <Text size="sm" fw={500}>{file.name}</Text>
                    <Text size="xs" c="dimmed">{formatFileSize(file.size)}</Text>
                  </div>
                </Group>
                <ActionIcon variant="subtle" color="red" onClick={() => handleRemoveFile(file)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

// K-Prim: 4 statements, each can be true or false
const KPrimQuestion = ({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: KPrimAnswer | undefined;
  onChange: (content: KPrimAnswer) => void;
}) => {
  const content = question.content as KPrimContent;

  const getAnswerForStatement = (statementId: string): boolean | undefined => {
    return answer?.answers.find((a) => a.statement_id === statementId)?.selected;
  };

  const handleStatementChange = (statementId: string, selected: boolean) => {
    const currentAnswers = answer?.answers || [];
    const existingIndex = currentAnswers.findIndex((a) => a.statement_id === statementId);

    let newAnswers;
    if (existingIndex >= 0) {
      newAnswers = [...currentAnswers];
      newAnswers[existingIndex] = { statement_id: statementId, selected };
    } else {
      newAnswers = [...currentAnswers, { statement_id: statementId, selected }];
    }

    onChange({ answers: newAnswers });
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Bewerten Sie jede Aussage als richtig oder falsch:
      </Text>
      {content.statements.map((statement, index) => {
        const currentValue = getAnswerForStatement(statement.id);
        return (
          <Paper key={statement.id} p="md" withBorder>
            <Group justify="space-between" wrap="nowrap">
              <Text style={{ flex: 1 }}>
                {index + 1}. {statement.text}
              </Text>
              <Group gap="md">
                <Checkbox
                  label="Richtig"
                  checked={currentValue === true}
                  onChange={() => handleStatementChange(statement.id, true)}
                  styles={{ label: { cursor: 'pointer' } }}
                />
                <Checkbox
                  label="Falsch"
                  checked={currentValue === false}
                  onChange={() => handleStatementChange(statement.id, false)}
                  styles={{ label: { cursor: 'pointer' } }}
                />
              </Group>
            </Group>
          </Paper>
        );
      })}
    </Stack>
  );
};

// Cloze/Fill-in-the-blanks
const ClozeQuestion = ({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: ClozeAnswer | undefined;
  onChange: (content: ClozeAnswer) => void;
}) => {
  const content = question.content as ClozeContent;

  const getAnswerForBlank = (blankId: string): string => {
    return answer?.answers.find((a) => a.blank_id === blankId)?.text || '';
  };

  const handleBlankChange = (blankId: string, text: string) => {
    const currentAnswers = answer?.answers || [];
    const existingIndex = currentAnswers.findIndex((a) => a.blank_id === blankId);

    let newAnswers;
    if (existingIndex >= 0) {
      newAnswers = [...currentAnswers];
      newAnswers[existingIndex] = { blank_id: blankId, text };
    } else {
      newAnswers = [...currentAnswers, { blank_id: blankId, text }];
    }

    onChange({ answers: newAnswers });
  };

  // Parse text and render with input fields for blanks
  const renderTextWithBlanks = () => {
    const parts = content.text.split(/(\{\{[^}]+\}\})/g);

    return parts.map((part, index) => {
      const match = part.match(/\{\{([^}]+)\}\}/);
      if (match) {
        const blankId = match[1];
        const blank = content.blanks.find((b) => b.id === blankId);
        if (!blank) return null;

        return (
          <TextInput
            key={index}
            placeholder={`Lücke ${content.blanks.indexOf(blank) + 1}`}
            value={getAnswerForBlank(blankId)}
            onChange={(e) => handleBlankChange(blankId, e.target.value)}
            style={{ display: 'inline-block', width: '150px', margin: '0 4px' }}
            size="sm"
          />
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Füllen Sie die Lücken aus:
      </Text>
      <Paper p="md" bg="gray.0" radius="md" style={{ lineHeight: 2.5 }}>
        {renderTextWithBlanks()}
      </Paper>
    </Stack>
  );
};

// Matching/Zuordnung
const MatchingQuestion = ({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: MatchingAnswer | undefined;
  onChange: (content: MatchingAnswer) => void;
}) => {
  const content = question.content as MatchingContent;

  const getMatchForLeft = (leftId: string): string => {
    return answer?.matches.find((m) => m.left_id === leftId)?.right_id || '';
  };

  const handleMatchChange = (leftId: string, rightId: string) => {
    const currentMatches = answer?.matches || [];
    const existingIndex = currentMatches.findIndex((m) => m.left_id === leftId);

    let newMatches;
    if (existingIndex >= 0) {
      newMatches = [...currentMatches];
      if (rightId) {
        newMatches[existingIndex] = { left_id: leftId, right_id: rightId };
      } else {
        newMatches.splice(existingIndex, 1);
      }
    } else if (rightId) {
      newMatches = [...currentMatches, { left_id: leftId, right_id: rightId }];
    } else {
      newMatches = currentMatches;
    }

    onChange({ matches: newMatches });
  };

  // Create options for the select dropdown (shuffled right side)
  const rightOptions = content.pairs.map((pair) => ({
    value: pair.id,
    label: pair.right,
  }));

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Ordnen Sie die Begriffe einander zu:
      </Text>
      <SimpleGrid cols={1}>
        {content.pairs.map((pair, index) => (
          <Paper key={pair.id} p="md" withBorder>
            <Group justify="space-between" wrap="nowrap" gap="md">
              <Text fw={500} style={{ flex: 1 }}>
                {index + 1}. {pair.left}
              </Text>
              <Select
                placeholder="Wählen Sie..."
                data={rightOptions}
                value={getMatchForLeft(pair.id)}
                onChange={(value) => handleMatchChange(pair.id, value || '')}
                clearable
                style={{ minWidth: 200 }}
              />
            </Group>
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
};

// Essay/Aufsatz (longer form writing)
const EssayQuestion = ({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: EssayAnswer | undefined;
  onChange: (content: EssayAnswer) => void;
}) => {
  const content = question.content as EssayContent;
  const text = answer?.text || '';

  // Count words
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <Stack gap="md">
      {(content.min_words || content.max_words) && (
        <Group gap="md">
          {content.min_words && (
            <Badge variant="outline" color={wordCount >= content.min_words ? 'green' : 'orange'}>
              Min: {content.min_words} Wörter
            </Badge>
          )}
          {content.max_words && (
            <Badge variant="outline" color={wordCount <= content.max_words ? 'green' : 'red'}>
              Max: {content.max_words} Wörter
            </Badge>
          )}
          <Badge variant="light">
            Aktuell: {wordCount} Wörter
          </Badge>
        </Group>
      )}
      <Textarea
        placeholder="Schreiben Sie hier Ihren Aufsatz..."
        minRows={12}
        value={text}
        onChange={(e) => onChange({ text: e.target.value })}
        autosize
      />
    </Stack>
  );
};
