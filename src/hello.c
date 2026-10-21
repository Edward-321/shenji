#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
    if (argc > 1 && (argv[1][0] == '-' && argv[1][1] == 'v' && argv[1][2] == 0)) {
        printf("hello 1.0.0 (GitHub Actions cloud build)\n");
        exit(0);
    }
    printf("hello from iOS cloud build 👋\n");
    printf("compiled with Apple clang on macOS runner\n");
    exit(0);
}