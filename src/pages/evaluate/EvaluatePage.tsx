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
  UploadedFile,
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
  onClose,
}: {
  sessionId: string;
  questions: Question[];
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

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const awardedPoints = session.answers.reduce(
    (sum, a) => sum + (a.points_awarded || 0),
    0
  );

  const renderQuestionAnswer = (question: Question, answer: Answer | undefined, index: number) => {
    const isCorrectMC =
      question.type === 'multiple_choice' && answer
        ? (question.content as MultipleChoiceContent).options.find(
            o => o.id === (answer.content as MultipleChoiceAnswer).selected_option_id
          )?.is_correct
        : false;

    return (
      <Paper key={question.id} p="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Group gap="sm">
            <Text fw={500}>
              {index + 1}. {question.title}
            </Text>
            <Badge size="xs" color={
              question.type === 'multiple_choice' ? 'blue' :
              question.type === 'free_text' ? 'green' : 'orange'
            }>
              {question.type === 'multiple_choice' ? 'MC' :
               question.type === 'free_text' ? 'Text' : 'Datei'}
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
                  value={answer.points_awarded ?? (isCorrectMC ? question.points : 0)}
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

      {questions.map((question, index) => {
        const answer = getAnswerForQuestion(question.id);
        return renderQuestionAnswer(question, answer, index);
      })}

      <Group justify="flex-end">
        <Button onClick={onClose}>Schließen</Button>
      </Group>
    </Stack>
  );
};
