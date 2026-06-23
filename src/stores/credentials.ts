import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { api } from "@/lib/api";
import type {
  ApiCredential,
  CredentialCreate,
  CredentialUpdate,
} from "@/types/credential";

export const useCredentialStore = defineStore("credentials", () => {
  const items = ref<ApiCredential[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const loaded = ref(false);

  const count = computed(() => items.value.length);
  const activeCount = computed(
    () => items.value.filter((c) => c.status === "ACTIVE").length,
  );
  const expiredCount = computed(
    () => items.value.filter((c) => c.status === "EXPIRED").length,
  );
  const connectedCount = computed(
    () => items.value.filter((c) => c.connected).length,
  );

  async function fetch() {
    loading.value = true;
    error.value = null;
    try {
      const res = await api.getCredentials();
      items.value = res.data;
      loaded.value = true;
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : "Credentiallarni yuklab bo'lmadi";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /** Birinchi marta kerak bo'lganda yuklaydi. */
  async function ensureLoaded() {
    if (loaded.value || loading.value) return;
    await fetch().catch(() => {});
  }

  /** Yangilangan credentialni ro'yxatga joylaydi (id bo'yicha almashtiradi yoki qo'shadi). */
  function upsertLocal(cred: ApiCredential) {
    const idx = items.value.findIndex((c) => c.id === cred.id);
    if (idx >= 0) items.value[idx] = cred;
    else items.value.unshift(cred);
  }

  /** key/sugar/api-agent'ni qo'lda kiritib yangi credential qo'shadi. */
  async function create(body: CredentialCreate): Promise<ApiCredential> {
    const res = await api.createCredential(body);
    upsertLocal(res.data);
    return res.data;
  }

  /** Raw fetch/cURL'dan yangi credential qo'shadi. */
  async function importFromRaw(raw: string): Promise<ApiCredential> {
    const res = await api.importCredential(raw);
    upsertLocal(res.data);
    return res.data;
  }

  async function update(
    id: string,
    body: CredentialUpdate,
  ): Promise<ApiCredential> {
    const res = await api.updateCredential(id, body);
    upsertLocal(res.data);
    return res.data;
  }

  async function reauthorize(id: string): Promise<ApiCredential> {
    const res = await api.reauthorizeCredential(id);
    upsertLocal(res.data);
    return res.data;
  }

  /** Yumshoq o'chiradi (status DELETED) va ro'yxatdan olib tashlaydi. */
  async function remove(id: string): Promise<void> {
    await api.deleteCredential(id);
    items.value = items.value.filter((c) => c.id !== id);
  }

  return {
    items,
    loading,
    error,
    loaded,
    count,
    activeCount,
    expiredCount,
    connectedCount,
    fetch,
    ensureLoaded,
    create,
    importFromRaw,
    update,
    reauthorize,
    remove,
  };
});
