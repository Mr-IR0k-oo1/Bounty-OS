#include <stdlib.h>

void cleanup(void) {
    char *buffer = malloc(64);

    free(buffer);
    free(buffer);
}
