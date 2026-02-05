import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Paper,
  Group,
  Stack,
  Badge,
  Button,
  Skeleton,
  Alert,
  Table,
  NumberInput,
  Modal,
  Radio,
  Anchor,
} from '@mantine/core';
import { IconArrowLeft, IconAlertCircle, IconFile, IconDownload } from '@tabler/icons-react';
import { useGetExamWithQuestionsQuery } from '../../services/exams/examsApi';
import {
  useGetExamSessionsQuery,
  useGetSessionWithAnswersQuery,
  useAwardPointsMutation,
} from '../../services/sessions/sessionsApi';
import { notifications } from '@mantine/notifications';
import {
  Question,
  Answer,
  MultipleChoiceContent,
  MultipleChoiceAnswer,
  FreeTextAnswer,
  FileUploadAnswer,
  KPrimContent,
  KPrimAnswer,
  ClozeContent,
  ClozeAnswer,
  MatchingContent,
  MatchingAnswer,
  EssayAnswer,
  UploadedFile,
  ExamSectionWithQuestions,
} from '../../types/database';
import { supabase } from '../../services/common/supabase';

export const EvaluatePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const { data: exam, isLoading: loadingExam } = useGetExamWithQuestionsQuery(id || '', {
    skip: !id,
  });

  const { data: sessions, isLoading: loadingSessions } = useGetExamSessionsQuery(id || '', {
    skip: !id,
  });

  const submittedSessions = sessions?.filter(s => s.submitted_at) || [];

  if (loadingExam || loadingSessions) {
    return (
      <Container size="lg">
        <Stack gap="md">
          <Skeleton height={40} />
          <Skeleton height={200} />
        </Stack>
      </Container>
    );
  }

  if (!exam) {
    return (
      <Container size="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          Prüfung konnte nicht geladen werden.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate(`/exams/${id}`)}
            >
              Zurück
            </Button>
            <Title order={2}>{exam.title} - Auswertung</Title>
          </Group>
        </Group>

        <Paper p="lg" radius="md" withBorder>
          <Title order={4} mb="md">
            Abgegebene Prüfungen ({submittedSessions.length})
          </Title>
          {submittedSessions.length === 0 ? (
            <Text c="dimmed" size="sm">
              Noch keine abgegebenen Prüfungen.
            </Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>E-Mail</Table.Th>
                  <Table.Th>Abgegeben</Table.Th>
                  <Table.Th>Aktion</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {submittedSessions.map((session) => (
                  <Table.Tr key={session.id}>
                    <Table.Td>{session.student_name}</Table.Td>
                    <Table.Td>{session.student_email}</Table.Td>
                    <Table.Td>
                      {session.submitted_at &&
                        new Date(session.submitted_at).toLocaleString('de-DE')}
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => setSelectedSessionId(session.id)}
                      >
                        Bewerten
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        <Modal
          opened={!!selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
          size="xl"
          title="Prüfung bewerten"
        >
          {selectedSessionId && (
            <SessionEvaluation
              sessionId={selectedSessionId}
              questions={exam.questions}
              sections={exam.sections}
              onClose={() => setSelectedSessionId(null)}
            />
          )}
        </Modal>
      </Stack>
    </Container>
  );
};

const SessionEvaluation = ({
  sessionId,
  questions,
  sections,
  onClose,
}: {
  sessionId: string;
  questions: Question[];
  sections?: ExamSectionWithQuestions[];
  onClose: () => void;
}) => {
  const { data: session, isLoading } = useGetSessionWithAnswersQuery(sessionId);
  const [awardPoints] = useAwardPointsMutation();

  if (isLoading || !session) {
    return <Skeleton height={200} />;
  }

  const getAnswerForQuestion = (questionId: string): Answer | undefined => {
    return session.answers.find(a => a.question_id === questionId);
  };

  const handleAwardPoints = async (answerId: string, points: number) => {
    try {
      await awardPoints({ answer_id: answerId, points }).unwrap();
      notifications.show({
        title: 'Punkte vergeben',
        message: 'Die Punkte wurden gespeichert.',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Punkte konnten nicht gespeichert werden.',
        color: 'red',
      });
    }
  };

  const handleDownloadFile = async (file: UploadedFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('exam-uploads')
        .download(file.path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      notifications.show({
        title: 'Fehler',
        message: 'Datei konnte nicht heruntergeladen werden.',
        color: 'red',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasSections = sections && sections.length > 0;
  const allQuestions = hasSections
    ? sections.flatMap(s => s.questions)
    : questions;

  const totalPoints = allQuestions.reduce((sum, q) => sum + q.points, 0);
  const awardedPoints = session.answers.reduce(
    (sum, a) => sum + (a.points_awarded || 0),
    0
  );

  const getSectionTotalPoints = (section: ExamSectionWithQuestions): number => {
    return section.questions.reduce((sum, q) => sum + q.points, 0);
  };

  const getSectionAwardedPoints = (section: ExamSectionWithQuestions): number => {
    return section.questions.reduce((sum, q) => {
      const answer = getAnswerForQuestion(q.id);
      return sum + (answer?.points_awarded || 0);
    }, 0);
  };

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case 'multiple_choice': return 'MC';
      case 'free_text': return 'Text';
      case 'file_upload': return 'Datei';
      case 'kprim': return 'K-Prim';
      case 'cloze': return 'Lücken';
      case 'matching': return 'Zuordn.';
      case 'essay': return 'Aufsatz';
      default: return type;
    }
  };

  const getQuestionTypeColor = (type: string) => {
    switch (type) {
      case 'multiple_choice': return 'blue';
      case 'free_text': return 'green';
      case 'file_upload': return 'orange';
      case 'kprim': return 'violet';
      case 'cloze': return 'cyan';
      case 'matching': return 'pink';
      case 'essay': return 'teal';
      default: return 'gray';
    }
  };

  const calculateKPrimScore = (question: Question, answer: Answer | undefined): number => {
    if (!answer) return 0;
    const content = question.content as KPrimContent;
    const answerContent = answer.content as KPrimAnswer;

    let correctCount = 0;
    content.statements.forEach(statement => {
      const studentAnswer = answerContent.answers.find(a => a.statement_id === statement.id);
      if (studentAnswer && studentAnswer.selected === statement.is_true) {
        correctCount++;
      }
    });

    // Standard K-Prim scoring: all 4 correct = full points, 3 correct = half, else 0
    if (correctCount === 4) return question.points;
    if (correctCount === 3) return Math.round(question.points / 2);
    return 0;
  };

  const calculateClozeScore = (question: Question, answer: Answer | undefined): number => {
    if (!answer) return 0;
    const content = question.content as ClozeContent;
    const answerContent = answer.content as ClozeAnswer;

    let correctCount = 0;
    content.blanks.forEach(blank => {
      const studentAnswer = answerContent.answers.find(a => a.blank_id === blank.id);
      if (studentAnswer) {
        const studentText = blank.case_sensitive ? studentAnswer.text : studentAnswer.text.toLowerCase();
        const isCorrect = blank.correct_answers.some(correct => {
          const correctText = blank.case_sensitive ? correct : correct.toLowerCase();
          return studentText.trim() === correctText.trim();
        });
        if (isCorrect) correctCount++;
      }
    });

    // Proportional scoring
    return Math.round((correctCount / content.blanks.length) * question.points);
  };

  const calculateMatchingScore = (question: Question, answer: Answer | undefined): number => {
    if (!answer) return 0;
    const content = question.content as MatchingContent;
    const answerContent = answer.content as MatchingAnswer;

    let correctCount = 0;
    content.pairs.forEach(pair => {
      const studentMatch = answerContent.matches.find(m => m.left_id === pair.id);
      if (studentMatch && studentMatch.right_id === pair.id) {
        correctCount++;
      }
    });

    // Proportional scoring
    return Math.round((correctCount / content.pairs.length) * question.points);
  };

  const renderQuestionAnswer = (question: Question, answer: Answer | undefined, index: number) => {
    const isCorrectMC =
      question.type === 'multiple_choice' && answer
        ? (question.content as MultipleChoiceContent).options.find(
            o => o.id === (answer.content as MultipleChoiceAnswer).selected_option_id
          )?.is_correct
        : false;

    // Calculate auto-score for different question types
    const getAutoScore = (): number | null => {
      if (question.type === 'multiple_choice') {
        return isCorrectMC ? question.points : 0;
      }
      if (question.type === 'kprim') {
        return calculateKPrimScore(question, answer);
      }
      if (question.type === 'cloze') {
        return calculateClozeScore(question, answer);
      }
      if (question.type === 'matching') {
        return calculateMatchingScore(question, answer);
      }
      return null; // Manual grading required
    };

    const autoScore = getAutoScore();

    return (
      <Paper key={question.id} p="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Group gap="sm">
            <Text fw={500}>
              {index + 1}. {question.title}
            </Text>
            <Badge size="xs" color={getQuestionTypeColor(question.type)}>
              {getQuestionTypeLabel(question.type)}
            </Badge>
          </Group>
          <Badge variant="outline">{question.points} Punkte</Badge>
        </Group>

        <Text size="sm" c="dimmed" mb="md">
          {(question.content as { question: string }).question}
        </Text>

        {question.type === 'multiple_choice' && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>Antwort:</Text>
            {(question.content as MultipleChoiceContent).options.map(option => {
              const isSelected =
                answer &&
                (answer.content as MultipleChoiceAnswer).selected_option_id === option.id;
              return (
                <Group key={option.id} gap="xs">
                  <Radio checked={!!isSelected} readOnly />
                  <Text
                    size="sm"
                    c={option.is_correct ? 'green' : isSelected ? 'red' : undefined}
                    fw={option.is_correct || isSelected ? 500 : undefined}
                  >
                    {option.text}
                    {option.is_correct && ' (Richtig)'}
                  </Text>
                </Group>
              );
            })}
            {answer && (
              <Group mt="sm">
                <Text size="sm">Punkte:</Text>
                <NumberInput
                  size="xs"
                  min={0}
                  max={question.points}
                  value={answer.points_awarded ?? autoScore ?? 0}
                  onChange={(value) => handleAwardPoints(answer.id, Number(value) || 0)}
                  style={{ width: 80 }}
                />
              </Group>
            )}
          </Stack>
        )}

        {question.type === 'free_text' && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>Antwort:</Text>
            <Paper p="sm" bg="gray.0">
              <Text size="sm">
                {answer
                  ? (answer.content as FreeTextAnswer).text || '(Keine Antwort)'
                  : '(Keine Antwort)'}
              </Text>
            </Paper>
            {answer && (
              <Group mt="sm">
                <Text size="sm">Punkte:</Text>
                <NumberInput
                  size="xs"
                  min={0}
                  max={question.points}
                  value={answer.points_awarded ?? 0}
                  onChange={(value) => handleAwardPoints(answer.id, Number(value) || 0)}
                  style={{ width: 80 }}
                />
              </Group>
            )}
          </Stack>
        )}

        {question.type === 'file_upload' && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>Hochgeladene Dateien:</Text>
            {answer && (answer.content as FileUploadAnswer).files?.length > 0 ? (
              <Stack gap="xs">
                {(answer.content as FileUploadAnswer).files.map((file) => (
                  <Paper key={file.path} p="sm" bg="gray.0">
                    <Group justify="space-between">
                      <Group gap="sm">
                        <IconFile size={20} />
                        <div>
                          <Text size="sm" fw={500}>{file.name}</Text>
                          <Text size="xs" c="dimmed">{formatFileSize(file.size)}</Text>
                        </div>
                      </Group>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconDownload size={14} />}
                        onClick={() => handleDownloadFile(file)}
                      >
                        Download
                      </Button>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Paper p="sm" bg="gray.0">
                <Text size="sm" c="dimmed">(Keine Dateien hochgeladen)</Text>
              </Paper>
            )}
            {answer && (
              <Group mt="sm">
                <Text size="sm">Punkte:</Text>
                <NumberInput
                  size="xs"
                  min={0}
                  max={question.points}
                  value={answer.points_awarded ?? 0}
                  onChange={(value) => handleAwardPoints(answer.id, Number(value) || 0)}
                  style={{ width: 80 }}
                />
              </Group>
            )}
          </Stack>
        )}

        {question.type === 'kprim' && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>Aussagen-Bewertung:</Text>
            {(question.content as KPrimContent).statements.map((statement, sIndex) => {
              const studentAnswer = answer
                ? (answer.content as KPrimAnswer).answers.find(a => a.statement_id === statement.id)
                : undefined;
              const isCorrect = studentAnswer?.selected === statement.is_true;
              return (
                <Paper key={statement.id} p="sm" bg="gray.0">
                  <Group justify="space-between" wrap="nowrap">
                    <Text size="sm" style={{ flex: 1 }}>
                      {sIndex + 1}. {statement.text}
                    </Text>
                    <Group gap="md">
                      <Badge
                        color={statement.is_true ? 'green' : 'red'}
                        variant="outline"
                        size="sm"
                      >
                        {statement.is_true ? 'Richtig' : 'Falsch'}
                      </Badge>
                      {studentAnswer !== undefined ? (
                        <Badge
                          color={isCorrect ? 'green' : 'red'}
                          size="sm"
                        >
                          {studentAnswer.selected ? 'R' : 'F'} {isCorrect ? '✓' : '✗'}
                        </Badge>
                      ) : (
                        <Badge color="gray" size="sm">-</Badge>
                      )}
                    </Group>
                  </Group>
                </Paper>
              );
            })}
            {answer && (
              <Group mt="sm">
                <Text size="sm">Punkte (Auto: {autoScore}):</Text>
                <NumberInput
                  size="xs"
                  min={0}
                  max={question.points}
                  value={answer.points_awarded ?? autoScore ?? 0}
                  onChange={(value) => handleAwardPoints(answer.id, Number(value) || 0)}
                  style={{ width: 80 }}
                />
              </Group>
            )}
          </Stack>
        )}

        {question.type === 'cloze' && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>Lückentext-Antworten:</Text>
            {(question.content as ClozeContent).blanks.map((blank, bIndex) => {
              const studentAnswer = answer
                ? (answer.content as ClozeAnswer).answers.find(a => a.blank_id === blank.id)
                : undefined;
              const studentText = studentAnswer?.text || '';
              const normalizedStudent = blank.case_sensitive ? studentText : studentText.toLowerCase();
              const isCorrect = blank.correct_answers.some(correct => {
                const normalizedCorrect = blank.case_sensitive ? correct : correct.toLowerCase();
                return normalizedStudent.trim() === normalizedCorrect.trim();
              });
              return (
                <Paper key={blank.id} p="sm" bg="gray.0">
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ flex: 1 }}>
                      <Text size="sm" fw={500}>Lücke {bIndex + 1}:</Text>
                      <Text size="sm" c={isCorrect ? 'green' : 'red'}>
                        Antwort: "{studentText || '(leer)'}"
                      </Text>
                      <Text size="xs" c="dimmed">
                        Richtig: {blank.correct_answers.join(' / ')}
                      </Text>
                    </div>
                    <Badge color={isCorrect ? 'green' : 'red'}>
                      {isCorrect ? '✓' : '✗'}
                    </Badge>
                  </Group>
                </Paper>
              );
            })}
            {answer && (
              <Group mt="sm">
                <Text size="sm">Punkte (Auto: {autoScore}):</Text>
                <NumberInput
                  size="xs"
                  min={0}
                  max={question.points}
                  value={answer.points_awarded ?? autoScore ?? 0}
                  onChange={(value) => handleAwardPoints(answer.id, Number(value) || 0)}
                  style={{ width: 80 }}
                />
              </Group>
            )}
          </Stack>
        )}

        {question.type === 'matching' && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>Zuordnungen:</Text>
            {(question.content as MatchingContent).pairs.map((pair, pIndex) => {
              const studentMatch = answer
                ? (answer.content as MatchingAnswer).matches.find(m => m.left_id === pair.id)
                : undefined;
              const matchedPair = studentMatch
                ? (question.content as MatchingContent).pairs.find(p => p.id === studentMatch.right_id)
                : undefined;
              const isCorrect = studentMatch?.right_id === pair.id;
              return (
                <Paper key={pair.id} p="sm" bg="gray.0">
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ flex: 1 }}>
                      <Text size="sm" fw={500}>{pIndex + 1}. {pair.left}</Text>
                      <Text size="sm" c={isCorrect ? 'green' : 'red'}>
                        → {matchedPair?.right || '(nicht zugeordnet)'}
                      </Text>
                      {!isCorrect && (
                        <Text size="xs" c="dimmed">Richtig: {pair.right}</Text>
                      )}
                    </div>
                    <Badge color={isCorrect ? 'green' : 'red'}>
                      {isCorrect ? '✓' : '✗'}
                    </Badge>
                  </Group>
                </Paper>
              );
            })}
            {answer && (
              <Group mt="sm">
                <Text size="sm">Punkte (Auto: {autoScore}):</Text>
                <NumberInput
                  size="xs"
                  min={0}
                  max={question.points}
                  value={answer.points_awarded ?? autoScore ?? 0}
                  onChange={(value) => handleAwardPoints(answer.id, Number(value) || 0)}
                  style={{ width: 80 }}
                />
              </Group>
            )}
          </Stack>
        )}

        {question.type === 'essay' && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>Aufsatz:</Text>
            <Paper p="sm" bg="gray.0">
              {answer ? (
                <>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {(answer.content as EssayAnswer).text || '(Keine Antwort)'}
                  </Text>
                  {(answer.content as EssayAnswer).text && (
                    <Text size="xs" c="dimmed" mt="sm">
                      Wörter: {(answer.content as EssayAnswer).text.trim().split(/\s+/).length}
                    </Text>
                  )}
                </>
              ) : (
                <Text size="sm" c="dimmed">(Keine Antwort)</Text>
              )}
            </Paper>
            {answer && (
              <Group mt="sm">
                <Text size="sm">Punkte:</Text>
                <NumberInput
                  size="xs"
                  min={0}
                  max={question.points}
                  value={answer.points_awarded ?? 0}
                  onChange={(value) => handleAwardPoints(answer.id, Number(value) || 0)}
                  style={{ width: 80 }}
                />
              </Group>
            )}
          </Stack>
        )}
      </Paper>
    );
  };

  return (
    <Stack gap="md">
      <Paper p="md" bg="gray.0">
        <Group justify="space-between">
          <div>
            <Text fw={500}>{session.student_name}</Text>
            <Text size="sm" c="dimmed">{session.student_email}</Text>
          </div>
          <Badge size="lg">
            {awardedPoints} / {totalPoints} Punkte
          </Badge>
        </Group>
      </Paper>

      {hasSections ? (
        // Render grouped by sections
        sections.map((section, sectionIndex) => (
          <Paper key={section.id} p="md" withBorder>
            <Group justify="space-between" mb="md">
              <div>
                <Badge mb="xs">Sektion {sectionIndex + 1}</Badge>
                <Text fw={600}>{section.title}</Text>
                {section.description && (
                  <Text size="sm" c="dimmed">{section.description}</Text>
                )}
              </div>
              <Badge size="lg" color="blue">
                {getSectionAwardedPoints(section)} / {getSectionTotalPoints(section)} Punkte
              </Badge>
            </Group>
            <Stack gap="sm">
              {section.questions.map((question, index) => {
                const answer = getAnswerForQuestion(question.id);
                return renderQuestionAnswer(question, answer, index);
              })}
            </Stack>
          </Paper>
        ))
      ) : (
        // Render flat list (backward compatibility)
        questions.map((question, index) => {
          const answer = getAnswerForQuestion(question.id);
          return renderQuestionAnswer(question, answer, index);
        })
      )}

      <Group justify="flex-end">
        <Button onClick={onClose}>Schließen</Button>
      </Group>
    </Stack>
  );
};
