import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { router } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.90.75.12:8080';

const CATEGORIES = ['Travel', 'Music', 'Gaming', 'Education', 'Tech', 'Sports', 'Food', 'Vlog'];

function formatDuration(seconds: number) {
  const t = Math.round(seconds);
  const pad = (n: number) => String(n).padStart(2, '0');
  const ms = `${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
  return t >= 3600 ? `${Math.floor(t / 3600)}:${ms}` : ms;
}

function formatSize(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function pickFile(accept: string): Promise<File | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

function readMetadata(uri: string) {
  return new Promise<VideoMeta>((resolve) => {
    const video = Object.assign(document.createElement('video'), { preload: 'metadata' });
    video.onloadedmetadata = () =>
      resolve({
        resolution: video.videoWidth > 0 ? `${video.videoWidth}x${video.videoHeight}` : null,
        duration: Number.isFinite(video.duration) ? formatDuration(video.duration) : null,
      });
    video.onerror = () => resolve({ resolution: null, duration: null });
    video.src = uri;
  });
}

type VideoMeta = { resolution: string | null; duration: string | null };
type PickedVideo = VideoMeta & { file: File; previewUri: string };

export default function UploadDash() {
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<AbortController | null>(null);

  useEffect(() => (video ? () => URL.revokeObjectURL(video.previewUri) : undefined), [video]);
  useEffect(() => () => uploadRef.current?.abort(), []);

  const acceptVideo = async (file: File) => {
    if (file.type !== 'video/mp4' && !/\.mp4$/i.test(file.name)) {
      setErrors(['Only MP4 videos are supported.']);
      return;
    }
    const previewUri = URL.createObjectURL(file);
    const meta = await readMetadata(previewUri);
    setErrors([]);
    setVideo({ file, previewUri, ...meta });
  };

  const chooseVideo = async () => {
    const file = await pickFile('video/mp4');
    if (file) await acceptVideo(file);
  };

  const submit = async () => {
    const missing = [
      !video && 'Choose a video.',
      !title.trim() && 'Add a title.',
      !description.trim() && 'Add a description.',
      !category.trim() && 'Pick a category.',
    ].filter((m): m is string => !!m);
    setErrors(missing);
    if (missing.length > 0 || !video) return;

    const details = [
      `Category: ${category.trim()}`,
      video.duration && `Duration: ${video.duration}`,
      video.resolution && `Resolution: ${video.resolution}`,
    ].filter(Boolean);

    const form = new FormData();
    form.append('video', video.file, video.file.name);
    form.append('title', title.trim());
    form.append('description', `${description.trim()}\n\n${details.join('\n')}`);

    const controller = new AbortController();
    uploadRef.current = controller;
    setUploading(true);
    try {
      const response = await fetch(`${API_URL}/api/videos/upload`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Upload failed (${response.status}).`);
    } catch (error) {
      if (!controller.signal.aborted) {
        setErrors([
          error instanceof TypeError
            ? 'Upload failed. Check your connection and try again.'
            : error instanceof Error
              ? error.message
              : 'Upload failed.',
        ]);
      }
      return;
    } finally {
      uploadRef.current = null;
      setUploading(false);
    }

    setVideo(null);
    setTitle('');
    setDescription('');
    setCategory('');
    router.navigate('/');
  };

  const linkButton = (label: string, onPress: () => void, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={styles.linkButton}
    >
      <Text style={styles.linkButtonText}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Field label="Video">
        <DropZone onFile={acceptVideo} disabled={uploading}>
          {(dragging) =>
            video ? (
              <View style={styles.previewCard}>
                {Platform.OS === 'web' && (
                  <video src={video.previewUri} controls style={webStyles.player} />
                )}
                <View style={styles.previewInfo}>
                  <View style={styles.previewText}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {video.file.name}
                    </Text>
                    <Text style={styles.hint}>
                      {[
                        formatSize(video.file.size),
                        video.duration ?? 'duration unknown',
                        video.resolution ?? 'resolution unknown',
                      ].join(' · ')}
                    </Text>
                  </View>
                  {linkButton('Replace', chooseVideo, uploading)}
                </View>
                {dragging && <Text style={styles.dropOverlayText}>Drop to replace</Text>}
              </View>
            ) : (
              <Pressable
                onPress={chooseVideo}
                disabled={uploading}
                accessibilityRole="button"
                accessibilityLabel="Choose a video to upload"
                style={styles.dropEmpty}
              >
                <View style={styles.dropIcon}>
                  <Text style={styles.dropIconText}>↑</Text>
                </View>
                <Text style={styles.dropTitle}>
                  {dragging ? 'Drop it here' : 'Drag and drop an MP4 here'}
                </Text>
                <Text style={styles.hint}>or click to choose a file</Text>
              </Pressable>
            )
          }
        </DropZone>
      </Field>

      <Field label="Title">
        <Input value={title} onChangeText={setTitle} placeholder="Give your video a title" />
      </Field>

      <Field label="Description">
        <Input
          value={description}
          onChangeText={setDescription}
          placeholder="What is this video about?"
          multiline
          style={styles.multiline}
        />
      </Field>

      <Field label="Category">
        <View style={styles.chips}>
          {CATEGORIES.map((c) => {
            const on = c === category;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(on ? '' : c)}
                style={[styles.chip, on && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipText, on && styles.chipTextSelected]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
        <Input value={category} onChangeText={setCategory} placeholder="Or type your own" />
      </Field>

      {errors.length > 0 && (
        <View style={styles.errors} accessibilityRole="alert">
          {errors.map((m) => (
            <Text key={m} style={styles.errorText}>
              {m}
            </Text>
          ))}
        </View>
      )}

      {uploading ? (
        <View style={styles.uploadStatus} accessibilityLiveRegion="polite">
          <Text style={styles.uploadStatusText}>Uploading video…</Text>
          {linkButton('Cancel', () => uploadRef.current?.abort())}
        </View>
      ) : (
        <Pressable style={styles.submit} onPress={submit} accessibilityRole="button">
          <Text style={styles.submitText}>Upload</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function DropZone(props: {
  onFile: (file: File) => void;
  disabled?: boolean;
  children: (dragging: boolean) => ReactNode;
}) {
  const ref = useRef<View>(null);
  const [dragging, setDragging] = useState(false);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !el?.addEventListener) return;

    const handlers: Record<string, (e: DragEvent) => void> = {
      dragover: (e) => {
        e.preventDefault();
        if (!latest.current.disabled) setDragging(true);
      },
      dragleave: (e) => !el.contains(e.relatedTarget as Node | null) && setDragging(false),
      drop: (e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer?.files?.[0];
        if (file && !latest.current.disabled) latest.current.onFile(file);
      },
    };
    const entries = Object.entries(handlers) as [keyof HTMLElementEventMap, EventListener][];
    entries.forEach(([type, fn]) => el.addEventListener(type, fn));
    return () => entries.forEach(([type, fn]) => el.removeEventListener(type, fn));
  }, []);

  return (
    <View ref={ref} style={[styles.dropZone, dragging && styles.dropZoneActive]}>
      {props.children(dragging)}
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Input({ style, ...props }: TextInputProps) {
  return <TextInput placeholderTextColor="#8a8d86" style={[styles.input, style]} {...props} />;
}

const ACCENT = '#5b4bdb';
const SOFT = '#ecebfb';
const BORDER = '#d6d8d1';
const TEXT = '#242824';
const box = { borderWidth: 1, borderColor: BORDER, borderRadius: 8, backgroundColor: '#fff' };
const row = { flexDirection: 'row', alignItems: 'center' } as const;

const webStyles = {
  player: {
    width: '100%',
    aspectRatio: '16 / 9',
    borderRadius: 8,
    backgroundColor: '#000',
    display: 'block',
  },
} as const;

const styles = StyleSheet.create({
  container: { padding: 16, gap: 20, width: '100%', maxWidth: 640, alignSelf: 'center' },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: TEXT },
  hint: { fontSize: 13, color: '#62665f' },
  input: { ...box, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: TEXT },
  multiline: { minHeight: 120, textAlignVertical: 'top' },

  dropZone: {
    ...box,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#c9cbc4',
    borderRadius: 12,
  },
  dropZoneActive: { borderColor: ACCENT, backgroundColor: '#f1effd' },
  dropEmpty: { alignItems: 'center', gap: 6, paddingVertical: 36, paddingHorizontal: 16 },
  dropIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dropIconText: { color: ACCENT, fontSize: 22, fontWeight: '700' },
  dropTitle: { fontSize: 15, fontWeight: '600', color: TEXT },
  previewCard: { padding: 10, gap: 10 },
  previewInfo: { ...row, gap: 12 },
  previewText: { flex: 1, gap: 2 },
  fileName: { fontSize: 14, fontWeight: '600', color: TEXT },
  dropOverlayText: { textAlign: 'center', color: ACCENT, fontWeight: '600' },
  linkButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  linkButtonText: { color: ACCENT, fontWeight: '600', fontSize: 14 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { ...box, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipSelected: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipText: { fontSize: 13, color: TEXT },
  chipTextSelected: { color: '#fff' },

  errors: { gap: 4 },
  errorText: { color: '#b3261e', fontSize: 13 },

  submit: { backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  uploadStatus: { ...box, ...row, justifyContent: 'space-between', padding: 8 },
  uploadStatusText: { fontSize: 14, fontWeight: '600', color: TEXT },
});
