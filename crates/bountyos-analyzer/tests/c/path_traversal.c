#include <stdio.h>

FILE *open_user_file(const char *filename) {
    char path[256];
    snprintf(path, sizeof(path), "/var/data/%s", filename);
    return fopen(path, "r");
}
