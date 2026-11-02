import { ref } from 'vue'

const message = ref('')
let timer = 0

export function useToast() {
  function show(text: string) {
    message.value = text
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      if (message.value === text) message.value = ''
    }, 2800)
  }

  return { message, show }
}
