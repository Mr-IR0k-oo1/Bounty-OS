#include <stdlib.h>

void cleanup_safe(void) {
    char *buffer = malloc(64);
    if (buffer == NULL) {
        return;
    }

    free(buffer);
    buffer = NULL;
}
