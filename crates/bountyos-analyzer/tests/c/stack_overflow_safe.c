#include <string.h>

void copy_input(const char *input) {
    char buffer[64];

    if (strlen(input) >= sizeof(buffer)) {
        return;
    }

    strcpy(buffer, input);
}
