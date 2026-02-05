import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Paper,
  TextInput,
  Textarea,
  NumberInput,
  Button,
  Group,
  Stack,
  Checkbox,
  Skeleton,
  Badge,
  ActionIcon,
} from '@mantine/core';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useForm } from '@mantine/form';
import { IconGripVertical, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../services/auth/authSlice';
import {
  useGetExamQuery,
  useGetExamWithQuestionsQuery,
  useCreateExamMutation,
  useUpdateExamMutation,
  useAssignQuestionsMutation,
} from '../../services/exams/examsApi';
import { useGetQuestionsQuery } from '../../services/questions/questionsApi';
import { Question } from '../../types/database';

interface FormValues {
  title: string;
  description: string;
  time_limit_minutes: number | undefined;
  has_time_limit: boolean;
}

export const ExamEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuth();
  const isEditing = !!id;

  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  const { data: existingExam, isLoading: loadingExam } = useGetExamWithQuestionsQuery(id || '', {
    skip: !id,
  });

  const { data: allQuestions, isLoading: loadingQuestions } = useGetQuestionsQuery(user?.id || '', {
    skip: !user?.id,
  });

  const [createExam, { isLoading: creating }] = useCreateExamMutation();
  const [updateExam, { isLoading: updating }] = useUpdateExamMutation();
  const [assignQuestions] = useAssignQuestionsMutation();

  const form = useForm<FormValues>({
    initialValues: {
      title: '',
      description: '',
      time_limit_minutes: undefined,
      has_time_limit: false,
    },
    validate: {
      title: (value) => (value.length > 0 ? null : 'Titel ist erforderlich'),
    },
  });

  useEffect(() => {
    if (existingExam) {
      form.setValues({
        title: existingExam.title,
        description: existingExam.description || '',
        time_limit_minutes: existingExam.time_limit_minutes || undefined,
        has_time_limit: !!existingExam.time_limit_minutes,
      });
      setSelectedQuestions(existingExam.questions.map((q) => q.id));
    }
  }, [existingExam]);

  const handleSubmit = async (values: FormValues) => {
    if (!user?.id) return;

    try {
      let examId = id;

      if (isEditing && id) {
        await updateExam({
          id,
          data: {
            title: values.title,
            description: values.description || undefined,
            time_limit_minutes: values.has_time_limit ? values.time_limit_minutes : undefined,
          },
        }).unwrap();
      } else {
        const newExam = await createExam({
          teacher_id: user.id,
          title: values.title,
          description: values.description || undefined,
          time_limit_minutes: values.has_time_limit ? values.time_limit_minutes : undefined,
        }).unwrap();
        examId = newExam.id;
      }

      if (examId) {
        await assignQuestions({
          exam_id: examId,
          question_ids: selectedQuestions,
        }).unwrap();
      }

      notifications.show({
        title: isEditing ? 'Prüfung aktualisiert' : 'Prüfung erstellt',
        message: isEditing ? 'Die Änderungen wurden gespeichert.' : 'Die neue Prüfung wurde erstellt.',
        color: 'green',
      });
      navigate('/exams');
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Prüfung konnte nicht gespeichert werden.',
        color: 'red',
      });
    }
  };

  const toggleQuestion = (questionId: string) => {
    setSelectedQuestions((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    );
  };

  const removeQuestion = (questionId: string) => {
    setSelectedQuestions((prev) => prev.filter((id) => id !== questionId));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(selectedQuestions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSelectedQuestions(items);
  };

  const getSelectedQuestionObjects = () => {
    return selectedQuestions
      .map((id) => allQuestions?.find((q) => q.id === id))
      .filter(Boolean) as Question[];
  };

  const availableQuestions = allQuestions?.filter((q) => !selectedQuestions.includes(q.id)) || [];

  if (isEditing && loadingExam) {
    return (
      <Container size="lg">
        <Stack gap="md">
          <Skeleton height={40} />
          <Skeleton height={200} />
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="lg">
      <Stack gap="lg">
        <div>
          <Title order={2}>{isEditing ? 'Prüfung bearbeiten' : 'Neue Prüfung'}</Title>
          <Text c="dimmed" mt="xs">
            {isEditing
              ? 'Bearbeiten Sie die Prüfungsdetails und Aufgaben'
              : 'Erstellen Sie eine neue Prüfung und weisen Sie Aufgaben zu'}
          </Text>
        </div>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="lg">
            <Paper p="lg" radius="md" withBorder>
              <Title order={4} mb="md">
                Prüfungsdetails
              </Title>
              <Stack gap="md">
                <TextInput
                  label="Titel"
                  placeholder="z.B. Mathematik Klausur Q1"
                  required
                  {...form.getInputProps('title')}
                />
                <Textarea
                  label="Beschreibung"
                  placeholder="Optionale Beschreibung der Prüfung..."
                  minRows={2}
                  {...form.getInputProps('description')}
                />
                <Group>
                  <Checkbox
                    label="Zeitlimit festlegen"
                    checked={form.values.has_time_limit}
                    onChange={(e) => form.setFieldValue('has_time_limit', e.currentTarget.checked)}
                  />
                  {form.values.has_time_limit && (
                    <NumberInput
                      placeholder="Minuten"
                      min={1}
                      max={480}
                      style={{ width: 120 }}
                      {...form.getInputProps('time_limit_minutes')}
                    />
                  )}
                </Group>
              </Stack>
            </Paper>

            <Paper p="lg" radius="md" withBorder>
              <Title order={4} mb="md">
                Ausgewählte Aufgaben ({selectedQuestions.length})
              </Title>
              {selectedQuestions.length === 0 ? (
                <Text c="dimmed" size="sm">
                  Keine Aufgaben ausgewählt. Wählen Sie Aufgaben aus der Liste unten aus.
                </Text>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="questions">
                    {(provided) => (
                      <Stack gap="xs" ref={provided.innerRef} {...provided.droppableProps}>
                        {getSelectedQuestionObjects().map((question, index) => (
                          <Draggable key={question.id} draggableId={question.id} index={index}>
                            {(provided) => (
                              <Paper
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                p="sm"
                                bg="gray.0"
                              >
                                <Group justify="space-between" wrap="nowrap">
                                  <Group gap="sm" wrap="nowrap">
                                    <div {...provided.dragHandleProps}>
                                      <IconGripVertical size={16} color="gray" />
                                    </div>
                                    <Text size="sm" fw={500}>
                                      {index + 1}. {question.title}
                                    </Text>
                                    <Badge size="xs">
                                      {question.type === 'multiple_choice' ? 'MC' : 'Text'}
                                    </Badge>
                                    <Badge size="xs" variant="outline">
                                      {question.points} P.
                                    </Badge>
                                  </Group>
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    onClick={() => removeQuestion(question.id)}
                                  >
                                    <IconTrash size={14} />
                                  </ActionIcon>
                                </Group>
                              </Paper>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </Stack>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </Paper>

            <Paper p="lg" radius="md" withBorder>
              <Title order={4} mb="md">
                Verfügbare Aufgaben
              </Title>
              {loadingQuestions ? (
                <Stack gap="xs">
                  <Skeleton height={40} />
                  <Skeleton height={40} />
                </Stack>
              ) : availableQuestions.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {allQuestions?.length === 0
                    ? 'Sie haben noch keine Aufgaben erstellt.'
                    : 'Alle Aufgaben wurden bereits ausgewählt.'}
                </Text>
              ) : (
                <Stack gap="xs">
                  {availableQuestions.map((question) => (
                    <Paper
                      key={question.id}
                      p="sm"
                      bg="gray.0"
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleQuestion(question.id)}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm">
                          <Checkbox
                            checked={selectedQuestions.includes(question.id)}
                            onChange={() => toggleQuestion(question.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Text size="sm" fw={500}>
                            {question.title}
                          </Text>
                          <Badge size="xs">
                            {question.type === 'multiple_choice' ? 'MC' : 'Text'}
                          </Badge>
                          <Badge size="xs" variant="outline">
                            {question.points} P.
                          </Badge>
                        </Group>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Paper>

            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => navigate('/exams')}>
                Abbrechen
              </Button>
              <Button type="submit" loading={creating || updating}>
                {isEditing ? 'Speichern' : 'Erstellen'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Container>
  );
};
