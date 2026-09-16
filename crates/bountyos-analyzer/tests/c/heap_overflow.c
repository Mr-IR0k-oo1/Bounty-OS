#include <stdlib.h>
#include <string.h>

void fill_heap(const char *input) {
    char *chunk = malloc(32);
    if (!chunk) {
        return;
    }
    strcpy(chunk, input);
}
